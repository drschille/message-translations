import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { DEFAULT_LOCALE, appendActivityLog, requireAccess } from "./_lib/platform";

function normalizeStatus(status: string): "draft" | "drafting" | "needs_review" | "approved" | "blocked" {
  if (status === "drafting" || status === "needs_review" || status === "approved" || status === "blocked") {
    return status;
  }
  return "draft";
}

export const saveSegmentTranslation = mutation({
  args: {
    segmentId: v.id("segments"),
    locale: v.optional(v.string()),
    text: v.string(),
    reason: v.optional(v.string()),
    submitForReview: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireAccess(ctx, "editor");
    const segment = await ctx.db.get(args.segmentId);
    if (!segment) throw new Error("Segment not found");

    const locale = args.locale ?? DEFAULT_LOCALE;
    const now = Date.now();
    const normalizedText = args.text.trim();
    const nextText = normalizedText.length > 0 ? normalizedText : segment.sourceText;
    const nextStatus = args.submitForReview ? "needs_review" : "drafting";

    let translation = await ctx.db
      .query("translations")
      .withIndex("by_segmentId_and_locale", (q) => q.eq("segmentId", segment._id).eq("locale", locale))
      .unique();

    let previousVersionId = translation?.activeVersionId;
    if (!translation) {
      const translationId = await ctx.db.insert("translations", {
        tenantId: segment.tenantId,
        documentId: segment.documentId,
        segmentId: segment._id,
        locale,
        text: nextText,
        status: nextStatus,
        updatedByUserId: user._id,
        updatedAt: now,
      });
      translation = await ctx.db.get(translationId);
      previousVersionId = undefined;
    } else {
      await ctx.db.patch(translation._id, {
        text: nextText,
        status: nextStatus,
        updatedByUserId: user._id,
        updatedAt: now,
      });
    }
    if (!translation) throw new Error("Failed to save translation");

    const versionId = await ctx.db.insert("translationVersions", {
      tenantId: segment.tenantId,
      documentId: segment.documentId,
      segmentId: segment._id,
      translationId: translation._id,
      locale,
      text: nextText,
      status: nextStatus,
      kind: "edit",
      previousVersionId,
      reason: args.reason,
      actorUserId: user._id,
      createdAt: now,
    });

    await ctx.db.patch(translation._id, { activeVersionId: versionId });

    const segmentState = await ctx.db
      .query("workflowStates")
      .withIndex("by_segmentId_and_locale", (q) => q.eq("segmentId", segment._id).eq("locale", locale))
      .unique();
    if (segmentState) {
      await ctx.db.patch(segmentState._id, {
        status: nextStatus,
        updatedByUserId: user._id,
        updatedAt: now,
      });
    } else {
      const document = await ctx.db.get(segment.documentId);
      if (!document) throw new Error("Document not found");
      await ctx.db.insert("workflowStates", {
        tenantId: segment.tenantId,
        workflowTemplateId: document.workflowTemplateId,
        documentId: segment.documentId,
        segmentId: segment._id,
        locale,
        level: "segment",
        status: nextStatus,
        updatedByUserId: user._id,
        updatedAt: now,
      });
    }

    await appendActivityLog(ctx, {
      actorUserId: user._id,
      action: "translation.saved",
      entityType: "translation",
      entityId: String(translation._id),
      documentId: segment.documentId,
      segmentId: segment._id,
      translationId: translation._id,
      reason: args.reason,
      metadata: { toStatus: nextStatus, locale },
    });

    return { translationId: translation._id, versionId };
  },
});

export const setSegmentStatus = mutation({
  args: {
    segmentId: v.id("segments"),
    locale: v.optional(v.string()),
    status: v.union(
      v.literal("draft"),
      v.literal("drafting"),
      v.literal("needs_review"),
      v.literal("approved"),
      v.literal("blocked"),
    ),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const minimumRole = args.status === "approved" ? "reviewer" : "editor";
    const { user } = await requireAccess(ctx, minimumRole);
    const segment = await ctx.db.get(args.segmentId);
    if (!segment) throw new Error("Segment not found");
    const locale = args.locale ?? DEFAULT_LOCALE;
    const now = Date.now();

    const translation = await ctx.db
      .query("translations")
      .withIndex("by_segmentId_and_locale", (q) => q.eq("segmentId", segment._id).eq("locale", locale))
      .unique();
    if (!translation) throw new Error("Translation not found");

    const fromStatus = normalizeStatus(translation.status);
    await ctx.db.patch(translation._id, {
      status: args.status,
      updatedByUserId: user._id,
      updatedAt: now,
    });

    const versionId = await ctx.db.insert("translationVersions", {
      tenantId: translation.tenantId,
      documentId: translation.documentId,
      segmentId: translation.segmentId,
      translationId: translation._id,
      locale,
      text: translation.text,
      status: args.status,
      kind: "edit",
      previousVersionId: translation.activeVersionId,
      reason: args.reason ?? "Status changed",
      actorUserId: user._id,
      createdAt: now,
    });

    await ctx.db.patch(translation._id, { activeVersionId: versionId });

    const segmentState = await ctx.db
      .query("workflowStates")
      .withIndex("by_segmentId_and_locale", (q) => q.eq("segmentId", segment._id).eq("locale", locale))
      .unique();
    if (segmentState) {
      await ctx.db.patch(segmentState._id, {
        status: args.status,
        updatedByUserId: user._id,
        updatedAt: now,
      });
    }

    await appendActivityLog(ctx, {
      actorUserId: user._id,
      action: "translation.status_updated",
      entityType: "translation",
      entityId: String(translation._id),
      documentId: translation.documentId,
      segmentId: translation.segmentId,
      translationId: translation._id,
      reason: args.reason,
      metadata: { fromStatus, toStatus: args.status, locale },
    });

    return { ok: true, versionId };
  },
});

export const restoreVersion = mutation({
  args: {
    segmentId: v.id("segments"),
    locale: v.optional(v.string()),
    versionId: v.id("translationVersions"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireAccess(ctx, "reviewer");
    const segment = await ctx.db.get(args.segmentId);
    if (!segment) throw new Error("Segment not found");
    const locale = args.locale ?? DEFAULT_LOCALE;
    const now = Date.now();

    const targetVersion = await ctx.db.get(args.versionId);
    if (!targetVersion || targetVersion.segmentId !== segment._id || targetVersion.locale !== locale) {
      throw new Error("Version not found");
    }

    const translation = await ctx.db
      .query("translations")
      .withIndex("by_segmentId_and_locale", (q) => q.eq("segmentId", segment._id).eq("locale", locale))
      .unique();
    if (!translation) throw new Error("Translation not found");

    await ctx.db.patch(translation._id, {
      text: targetVersion.text,
      status: targetVersion.status,
      updatedByUserId: user._id,
      updatedAt: now,
    });

    const restoreVersionId = await ctx.db.insert("translationVersions", {
      tenantId: translation.tenantId,
      documentId: translation.documentId,
      segmentId: translation.segmentId,
      translationId: translation._id,
      locale,
      text: targetVersion.text,
      status: targetVersion.status,
      kind: "restore",
      previousVersionId: translation.activeVersionId,
      restoredFromVersionId: args.versionId,
      reason: args.reason ?? "Restored previous version",
      actorUserId: user._id,
      createdAt: now,
    });

    await ctx.db.patch(translation._id, { activeVersionId: restoreVersionId });

    const segmentState = await ctx.db
      .query("workflowStates")
      .withIndex("by_segmentId_and_locale", (q) => q.eq("segmentId", segment._id).eq("locale", locale))
      .unique();
    if (segmentState) {
      await ctx.db.patch(segmentState._id, {
        status: targetVersion.status,
        updatedByUserId: user._id,
        updatedAt: now,
      });
    }

    await appendActivityLog(ctx, {
      actorUserId: user._id,
      action: "translation.version_restored",
      entityType: "translationVersion",
      entityId: String(restoreVersionId),
      documentId: translation.documentId,
      segmentId: translation.segmentId,
      translationId: translation._id,
      reason: args.reason,
      metadata: { toStatus: targetVersion.status, locale },
    });

    return { ok: true, versionId: restoreVersionId };
  },
});

