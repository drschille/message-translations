import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import {
  DEFAULT_LOCALE,
  appendActivityLog,
  ensureBootstrapDefaults,
  requireAccess,
} from "./_lib/platform";

function splitTranscript(transcript: string): string[] {
  const byDoubleLine = transcript
    .split(/\n\s*\n/g)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
  if (byDoubleLine.length > 0) {
    return byDoubleLine;
  }
  return transcript
    .split(/(?<=[.!?])\s+/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
}

function computeDocumentStatus(statuses: string[]): "draft" | "drafting" | "needs_review" | "approved" | "blocked" {
  if (statuses.length === 0) return "draft";
  if (statuses.every((s) => s === "approved")) return "approved";
  if (statuses.some((s) => s === "blocked")) return "blocked";
  if (statuses.some((s) => s === "needs_review")) return "needs_review";
  if (statuses.some((s) => s === "drafting")) return "drafting";
  return "draft";
}

async function getDefaultTemplateId(ctx: MutationCtx, tenantId: Id<"tenants">) {
  const template = await ctx.db
    .query("workflowTemplates")
    .withIndex("by_tenantId_and_isDefault", (q) => q.eq("tenantId", tenantId).eq("isDefault", true))
    .unique();
  if (!template) throw new Error("Default workflow template not found");
  return template._id as Id<"workflowTemplates">;
}

async function importLegacySermonDocument(
  ctx: MutationCtx,
  input: {
    tenantId: Id<"tenants">;
    userId: Id<"users">;
    workflowTemplateId: Id<"workflowTemplates">;
    sermonId: Id<"sermons">;
    locale: string;
  },
) {
  const now = Date.now();
  const existing = await ctx.db
    .query("documents")
    .withIndex("by_tenantId_and_externalRef", (q) =>
      q.eq("tenantId", input.tenantId).eq("externalRef", String(input.sermonId)),
    )
    .unique();
  if (existing) {
    return { documentId: existing._id, created: false };
  }

  const sermon = await ctx.db.get(input.sermonId);
  if (!sermon) throw new Error("Legacy sermon not found");

  const documentId = await ctx.db.insert("documents", {
    tenantId: input.tenantId,
    workflowTemplateId: input.workflowTemplateId,
    title: sermon.title,
    sourceLanguage: "en",
    sourceText: sermon.transcript,
    useCase: "sermon",
    externalRef: String(sermon._id),
    status: "draft",
    metadata: {
      summary: sermon.description,
      series: sermon.series,
      date: sermon.date,
    },
    createdByUserId: input.userId,
    createdAt: now,
    updatedAt: now,
  });

  await ctx.db.insert("documentLocales", {
    tenantId: input.tenantId,
    documentId,
    locale: input.locale,
    enabled: true,
    createdAt: now,
    updatedAt: now,
  });

  const legacyParagraphs = await ctx.db
    .query("sermonParagraphs")
    .withIndex("by_sermonId_and_order", (q) => q.eq("sermonId", input.sermonId))
    .collect();

  const fallbackParagraphs = (sermon.transcript ? splitTranscript(sermon.transcript) : []).map(
    (sourceText, index) => ({
      order: index + 1,
      sourceText,
      translatedText: sourceText,
      status: "draft" as const,
      updatedAt: now,
    }),
  );

  const rows = legacyParagraphs.length > 0 ? legacyParagraphs : fallbackParagraphs;
  const segmentStatuses: string[] = [];

  for (const paragraph of rows) {
    const segmentId = await ctx.db.insert("segments", {
      tenantId: input.tenantId,
      documentId,
      stableKey: `sermon:${String(input.sermonId)}:p:${paragraph.order}`,
      order: paragraph.order,
      sourceText: paragraph.sourceText,
      createdAt: now,
      updatedAt: paragraph.updatedAt ?? now,
    });

    const status =
      paragraph.status === "approved" ||
      paragraph.status === "needs_review" ||
      paragraph.status === "drafting"
        ? paragraph.status
        : "draft";

    segmentStatuses.push(status);

    const translationId = await ctx.db.insert("translations", {
      tenantId: input.tenantId,
      documentId,
      segmentId,
      locale: input.locale,
      text: paragraph.translatedText,
      status,
      updatedByUserId: input.userId,
      updatedAt: paragraph.updatedAt ?? now,
    });

    const versionId = await ctx.db.insert("translationVersions", {
      tenantId: input.tenantId,
      documentId,
      segmentId,
      translationId,
      locale: input.locale,
      text: paragraph.translatedText,
      status,
      kind: "import",
      actorUserId: input.userId,
      createdAt: paragraph.updatedAt ?? now,
    });

    await ctx.db.patch(translationId, { activeVersionId: versionId });

    await ctx.db.insert("workflowStates", {
      tenantId: input.tenantId,
      workflowTemplateId: input.workflowTemplateId,
      documentId,
      segmentId,
      locale: input.locale,
      level: "segment",
      status,
      updatedByUserId: input.userId,
      updatedAt: paragraph.updatedAt ?? now,
    });
  }

  const documentStatus = computeDocumentStatus(segmentStatuses);
  await ctx.db.patch(documentId, {
    status: documentStatus,
    updatedAt: now,
  });

  await ctx.db.insert("workflowStates", {
    tenantId: input.tenantId,
    workflowTemplateId: input.workflowTemplateId,
    documentId,
    segmentId: undefined,
    locale: input.locale,
    level: "document",
    status: documentStatus,
    updatedByUserId: input.userId,
    updatedAt: now,
  });

  await appendActivityLog(ctx, {
    actorUserId: input.userId,
    action: "document.imported_from_legacy_sermon",
    entityType: "document",
    entityId: String(documentId),
    documentId,
    reason: "Legacy sermon bridge import",
    metadata: { locale: input.locale },
  });

  return { documentId, created: true };
}

export const list = query({
  args: {
    paginationOpts: paginationOptsValidator,
    useCase: v.optional(v.string()),
    search: v.optional(v.string()),
    year: v.optional(v.string()),
    series: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireAccess(ctx, "viewer");
    const useCase = args.useCase ?? "sermon";

    if (!args.search && !args.year && !args.series) {
      return await ctx.db
        .query("documents")
        .withIndex("by_tenantId_and_useCase_and_updatedAt", (q) =>
          q.eq("tenantId", tenant._id).eq("useCase", useCase),
        )
        .order("desc")
        .paginate(args.paginationOpts);
    }

    const all = await ctx.db
      .query("documents")
      .withIndex("by_tenantId_and_useCase_and_updatedAt", (q) =>
        q.eq("tenantId", tenant._id).eq("useCase", useCase),
      )
      .order("desc")
      .take(500);

    const search = args.search?.toLowerCase();
    const filtered = all.filter((doc) => {
      if (search) {
        const inTitle = doc.title.toLowerCase().includes(search);
        const inSummary = doc.metadata?.summary?.toLowerCase().includes(search) ?? false;
        if (!inTitle && !inSummary) return false;
      }
      if (args.year) {
        const date = doc.metadata?.date;
        if (!date || !date.startsWith(args.year)) return false;
      }
      if (args.series) {
        const series = doc.metadata?.series;
        if (!series || series !== args.series) return false;
      }
      return true;
    });

    const page = filtered.slice(0, args.paginationOpts.numItems);
    const isDone = filtered.length <= args.paginationOpts.numItems;
    return { page, isDone, continueCursor: isDone ? "" : "manual_cursor" };
  },
});

export const getById = query({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    await requireAccess(ctx, "viewer");
    return await ctx.db.get(args.id);
  },
});

export const listSegments = query({
  args: {
    documentId: v.id("documents"),
    locale: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    await requireAccess(ctx, "viewer");
    const locale = args.locale ?? DEFAULT_LOCALE;

    const paged = await ctx.db
      .query("segments")
      .withIndex("by_documentId_and_order", (q) => q.eq("documentId", args.documentId))
      .paginate(args.paginationOpts);

    const hydrated = await Promise.all(
      paged.page.map(async (segment) => {
        const translation = await ctx.db
          .query("translations")
          .withIndex("by_segmentId_and_locale", (q) =>
            q.eq("segmentId", segment._id).eq("locale", locale),
          )
          .unique();

        return {
          _id: segment._id,
          _creationTime: segment._creationTime,
          order: segment.order,
          sourceText: segment.sourceText,
          translatedText: translation?.text ?? segment.sourceText,
          status: translation?.status ?? "draft",
          updatedAt: translation?.updatedAt ?? segment.updatedAt,
        };
      }),
    );

    return { ...paged, page: hydrated };
  },
});

export const ensureFromLegacySermon = mutation({
  args: {
    sermonId: v.id("sermons"),
    locale: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ensureBootstrapDefaults(ctx);
    const { tenant, user } = await requireAccess(ctx, "editor");
    const locale = args.locale ?? DEFAULT_LOCALE;
    const workflowTemplateId = await getDefaultTemplateId(ctx, tenant._id);
    return await importLegacySermonDocument(ctx, {
      tenantId: tenant._id,
      userId: user._id,
      workflowTemplateId,
      sermonId: args.sermonId,
      locale,
    });
  },
});

export const syncLegacySermons = mutation({
  args: {
    locale: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ensureBootstrapDefaults(ctx);
    const { tenant, user } = await requireAccess(ctx, "editor");
    const workflowTemplateId = await getDefaultTemplateId(ctx, tenant._id);
    const locale = args.locale ?? DEFAULT_LOCALE;

    const legacySermons = await ctx.db.query("sermons").collect();
    let created = 0;
    for (const sermon of legacySermons) {
      const imported = await importLegacySermonDocument(ctx, {
        tenantId: tenant._id,
        userId: user._id,
        workflowTemplateId,
        sermonId: sermon._id,
        locale,
      });
      if (imported.created) created += 1;
    }
    return { total: legacySermons.length, created };
  },
});
