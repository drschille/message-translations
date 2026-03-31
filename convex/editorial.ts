import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

const paragraphStatusValidator = v.union(
  v.literal("draft"),
  v.literal("drafting"),
  v.literal("needs_review"),
  v.literal("approved"),
);
const sermonProofreadingStateValidator = v.union(
  v.literal("queued"),
  v.literal("in_progress"),
  v.literal("done"),
);

const fallbackParagraphPairs = [
  {
    sourceText:
      "Good evening, friends. It's a privilege to be back here again tonight in the house of the Lord, to serve Him. And we're expecting a great time tonight.",
    translatedText:
      "God kveld, venner. Det er et privilegium å være tilbake her igjen i kveld i Herrens hus, for å tjene Ham. Og vi forventer en herlig tid i kveld.",
  },
  {
    sourceText:
      "Now, we are thinking today of how that the world has come to its place where it is today. We are in a changing time.",
    translatedText:
      "Nå tenker vi i dag på hvordan verden har kommet til det stedet den er i dag. Vi er i en skiftende tid.",
  },
  {
    sourceText:
      "Everything is changing. Politics is changing; national scenes are changing; the world itself is changing. But God's Word remains the same.",
    translatedText:
      "Alt forandrer seg. Politikken forandrer seg; nasjonale scener forandrer seg; selve verden forandrer seg. Men Guds Ord forblir det samme.",
  },
  {
    sourceText:
      "And we must find that place that God has chosen for us to rest in. Not in some political system, not in some man-made idea, but in Christ.",
    translatedText:
      "Og vi må finne det stedet som Gud har valgt ut for oss å hvile i. Ikke i et politisk system, ikke i en menneskeskapt idé, men i Kristus.",
  },
];

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

function normalizeLanguageCode(languageCode: string) {
  return languageCode.trim().toLowerCase() || "nb";
}

async function findTranslationByParagraphAndLanguage(
  ctx: MutationCtx,
  paragraphId: Id<"sermonParagraphs">,
  languageCode: string,
) {
  return await ctx.db
    .query("sermonParagraphTranslations")
    .withIndex("by_paragraphId_and_languageCode", (q) =>
      q.eq("paragraphId", paragraphId).eq("languageCode", languageCode),
    )
    .unique();
}

async function ensureTranslationForParagraph(
  ctx: MutationCtx,
  paragraph: {
    _id: Id<"sermonParagraphs">;
    sourceText: string;
    translatedText: string;
    status: "draft" | "drafting" | "needs_review" | "approved";
    updatedAt: number;
  },
  languageCode: string,
) {
  const normalized = normalizeLanguageCode(languageCode);
  const existing = await findTranslationByParagraphAndLanguage(ctx, paragraph._id, normalized);
  if (existing) {
    return existing;
  }

  const translationId = await ctx.db.insert("sermonParagraphTranslations", {
    paragraphId: paragraph._id,
    languageCode: normalized,
    translatedText:
      normalized === "nb"
        ? paragraph.translatedText
        : paragraph.sourceText,
    status: normalized === "nb" ? paragraph.status : "draft",
    updatedAt: Date.now(),
  });

  const created = await ctx.db.get(translationId);
  if (!created) {
    throw new Error("Failed to create paragraph translation");
  }
  return created;
}

export const ensureParagraphsForSermon = mutation({
  args: {
    sermonId: v.id("sermons"),
    languageCode: v.string(),
  },
  handler: async (ctx, args) => {
    const normalizedLanguage = normalizeLanguageCode(args.languageCode);

    const existing = await ctx.db
      .query("sermonParagraphs")
      .withIndex("by_sermonId_and_order", (q) => q.eq("sermonId", args.sermonId))
      .take(1);

    if (existing.length > 0) {
      const paragraphs = await ctx.db
        .query("sermonParagraphs")
        .withIndex("by_sermonId_and_order", (q) => q.eq("sermonId", args.sermonId))
        .take(500);

      for (const paragraph of paragraphs) {
        await ensureTranslationForParagraph(ctx, paragraph, normalizedLanguage);
      }

      return { created: false };
    }

    const sermon = await ctx.db.get(args.sermonId);
    if (!sermon) {
      throw new Error("Sermon not found");
    }

    const parsed = sermon.transcript ? splitTranscript(sermon.transcript) : [];
    const paragraphPairs =
      parsed.length > 0
        ? parsed.slice(0, 200).map((paragraph) => ({ sourceText: paragraph, translatedText: paragraph }))
        : fallbackParagraphPairs;

    const now = Date.now();
    for (let i = 0; i < paragraphPairs.length; i++) {
      const pair = paragraphPairs[i];
      const status = i === 1 ? "drafting" : i === 0 ? "approved" : i === 2 ? "needs_review" : "draft";
      const paragraphId = await ctx.db.insert("sermonParagraphs", {
        sermonId: args.sermonId,
        order: i + 1,
        sourceText: pair.sourceText,
        translatedText: pair.translatedText,
        status,
        updatedAt: now,
      });

      const translationId = await ctx.db.insert("sermonParagraphTranslations", {
        paragraphId,
        languageCode: normalizedLanguage,
        translatedText:
          normalizedLanguage === "nb"
            ? pair.translatedText
            : pair.sourceText,
        status: normalizedLanguage === "nb" ? status : "draft",
        updatedAt: now,
      });

      await ctx.db.insert("paragraphTranslationRevisions", {
        paragraphTranslationId: translationId,
        snapshotText:
          normalizedLanguage === "nb"
            ? pair.translatedText
            : pair.sourceText,
        status: normalizedLanguage === "nb" ? status : "draft",
        kind: "edit",
        reason: "Initial seed",
        authorName: "System",
        createdAt: now,
      });
    }

    return { created: true };
  },
});

export const listParagraphs = query({
  args: {
    sermonId: v.id("sermons"),
    languageCode: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const normalizedLanguage = normalizeLanguageCode(args.languageCode);
    const sourcePage = await ctx.db
      .query("sermonParagraphs")
      .withIndex("by_sermonId_and_order", (q) => q.eq("sermonId", args.sermonId))
      .paginate(args.paginationOpts);

    const page = await Promise.all(
      sourcePage.page.map(async (paragraph) => {
        const translation = await ctx.db
          .query("sermonParagraphTranslations")
          .withIndex("by_paragraphId_and_languageCode", (q) =>
            q.eq("paragraphId", paragraph._id).eq("languageCode", normalizedLanguage),
          )
          .unique();

        return {
          _id: paragraph._id,
          _creationTime: paragraph._creationTime,
          sermonId: paragraph.sermonId,
          order: paragraph.order,
          sourceText: paragraph.sourceText,
          translatedText: translation?.translatedText ?? paragraph.sourceText,
          status: translation?.status ?? "draft",
          updatedAt: translation?.updatedAt ?? paragraph.updatedAt,
        };
      }),
    );

    return {
      ...sourcePage,
      page,
    };
  },
});

export const listComments = query({
  args: {
    paragraphId: v.id("sermonParagraphs"),
    languageCode: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const translation = await ctx.db
      .query("sermonParagraphTranslations")
      .withIndex("by_paragraphId_and_languageCode", (q) =>
        q.eq("paragraphId", args.paragraphId).eq("languageCode", normalizeLanguageCode(args.languageCode)),
      )
      .unique();

    if (!translation) {
      return {
        page: [],
        isDone: true,
        continueCursor: "",
      };
    }

    return await ctx.db
      .query("paragraphTranslationComments")
      .withIndex("by_paragraphTranslationId_and_createdAt", (q) =>
        q.eq("paragraphTranslationId", translation._id),
      )
      .paginate(args.paginationOpts);
  },
});

export const listRevisions = query({
  args: {
    paragraphId: v.id("sermonParagraphs"),
    languageCode: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const translation = await ctx.db
      .query("sermonParagraphTranslations")
      .withIndex("by_paragraphId_and_languageCode", (q) =>
        q.eq("paragraphId", args.paragraphId).eq("languageCode", normalizeLanguageCode(args.languageCode)),
      )
      .unique();

    if (!translation) {
      return {
        page: [],
        isDone: true,
        continueCursor: "",
      };
    }

    return await ctx.db
      .query("paragraphTranslationRevisions")
      .withIndex("by_paragraphTranslationId_and_createdAt", (q) =>
        q.eq("paragraphTranslationId", translation._id),
      )
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

export const updateParagraphDraft = mutation({
  args: {
    paragraphId: v.id("sermonParagraphs"),
    languageCode: v.string(),
    translatedText: v.string(),
    reason: v.optional(v.string()),
    submitForReview: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const paragraph = await ctx.db.get(args.paragraphId);
    if (!paragraph) {
      throw new Error("Paragraph not found");
    }

    const translation = await ensureTranslationForParagraph(ctx, paragraph, args.languageCode);

    const identity = await ctx.auth.getUserIdentity();
    const now = Date.now();
    const normalized = args.translatedText.trim();
    const nextText = normalized.length > 0 ? normalized : translation.translatedText;
    const nextStatus = args.submitForReview ? "needs_review" : "drafting";

    await ctx.db.patch(translation._id, {
      translatedText: nextText,
      status: nextStatus,
      updatedAt: now,
    });

    await ctx.db.insert("paragraphTranslationRevisions", {
      paragraphTranslationId: translation._id,
      snapshotText: nextText,
      status: nextStatus,
      kind: "edit",
      reason: args.reason,
      authorName: identity?.name ?? identity?.email ?? "Anonymous editor",
      authorTokenIdentifier: identity?.tokenIdentifier,
      createdAt: now,
    });

    return { ok: true };
  },
});

export const updateParagraphStatus = mutation({
  args: {
    paragraphId: v.id("sermonParagraphs"),
    languageCode: v.string(),
    status: paragraphStatusValidator,
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const paragraph = await ctx.db.get(args.paragraphId);
    if (!paragraph) {
      throw new Error("Paragraph not found");
    }

    const translation = await ensureTranslationForParagraph(ctx, paragraph, args.languageCode);

    const identity = await ctx.auth.getUserIdentity();
    const now = Date.now();

    await ctx.db.patch(translation._id, {
      status: args.status,
      updatedAt: now,
    });

    await ctx.db.insert("paragraphTranslationRevisions", {
      paragraphTranslationId: translation._id,
      snapshotText: translation.translatedText,
      status: args.status,
      kind: "edit",
      reason: args.reason ?? "Status changed",
      authorName: identity?.name ?? identity?.email ?? "Anonymous editor",
      authorTokenIdentifier: identity?.tokenIdentifier,
      createdAt: now,
    });

    return { ok: true };
  },
});

export const setSermonProofreadingState = mutation({
  args: {
    sermonId: v.id("sermons"),
    state: sermonProofreadingStateValidator,
  },
  handler: async (ctx, args) => {
    const sermon = await ctx.db.get(args.sermonId);
    if (!sermon) {
      throw new Error("Sermon not found");
    }

    await ctx.db.patch(args.sermonId, {
      proofreadingState: args.state,
    });

    return { ok: true };
  },
});

export const publishSermonVersion = mutation({
  args: {
    sermonId: v.id("sermons"),
    languageCode: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const sermon = await ctx.db.get(args.sermonId);
    if (!sermon) {
      throw new Error("Sermon not found");
    }

    const proofreadingState = sermon.proofreadingState ?? "queued";
    if (proofreadingState !== "done") {
      throw new Error("Sermon must be marked as done before publishing");
    }

    const normalizedLanguage = normalizeLanguageCode(args.languageCode);
    const paragraphs = await ctx.db
      .query("sermonParagraphs")
      .withIndex("by_sermonId_and_order", (q) => q.eq("sermonId", args.sermonId))
      .take(2000);

    if (paragraphs.length === 0) {
      throw new Error("Cannot publish a sermon without paragraphs");
    }

    const identity = await ctx.auth.getUserIdentity();
    const publishedAt = Date.now();
    const version = (sermon.currentVersion ?? 0) + 1;

    const publishedVersionId = await ctx.db.insert("sermonPublishedVersions", {
      sermonId: args.sermonId,
      version,
      languageCode: normalizedLanguage,
      proofreadingState: "done",
      publishedAt,
      reason: args.reason,
      authorName: identity?.name ?? identity?.email ?? "Anonymous editor",
      authorTokenIdentifier: identity?.tokenIdentifier,
    });

    for (const paragraph of paragraphs) {
      const translation = await ctx.db
        .query("sermonParagraphTranslations")
        .withIndex("by_paragraphId_and_languageCode", (q) =>
          q.eq("paragraphId", paragraph._id).eq("languageCode", normalizedLanguage),
        )
        .unique();

      await ctx.db.insert("sermonPublishedParagraphSnapshots", {
        publishedVersionId,
        paragraphId: paragraph._id,
        order: paragraph.order,
        sourceText: paragraph.sourceText,
        translatedText: translation?.translatedText ?? paragraph.sourceText,
        status: translation?.status ?? "draft",
      });
    }

    await ctx.db.patch(args.sermonId, {
      isPublished: true,
      currentVersion: version,
      lastPublishedAt: publishedAt,
    });

    return {
      sermonId: args.sermonId,
      version,
      publishedAt,
    };
  },
});

export const listPublishedVersions = query({
  args: {
    sermonId: v.id("sermons"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sermonPublishedVersions")
      .withIndex("by_sermonId_and_version", (q) => q.eq("sermonId", args.sermonId))
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

export const getPublishedVersion = query({
  args: {
    sermonId: v.id("sermons"),
    version: v.number(),
  },
  handler: async (ctx, args) => {
    const publishedVersion = await ctx.db
      .query("sermonPublishedVersions")
      .withIndex("by_sermonId_and_version", (q) =>
        q.eq("sermonId", args.sermonId).eq("version", args.version),
      )
      .unique();

    if (!publishedVersion) {
      return null;
    }

    const paragraphs = await ctx.db
      .query("sermonPublishedParagraphSnapshots")
      .withIndex("by_publishedVersionId_and_order", (q) =>
        q.eq("publishedVersionId", publishedVersion._id),
      )
      .take(2000);

    return {
      ...publishedVersion,
      paragraphs,
    };
  },
});

export const addComment = mutation({
  args: {
    paragraphId: v.id("sermonParagraphs"),
    languageCode: v.string(),
    body: v.string(),
    parentCommentId: v.optional(v.id("paragraphTranslationComments")),
  },
  handler: async (ctx, args) => {
    const paragraph = await ctx.db.get(args.paragraphId);
    if (!paragraph) {
      throw new Error("Paragraph not found");
    }

    const translation = await ensureTranslationForParagraph(ctx, paragraph, args.languageCode);

    const text = args.body.trim();
    if (!text) {
      throw new Error("Comment cannot be empty");
    }
    const identity = await ctx.auth.getUserIdentity();
    const now = Date.now();
    const commentId = await ctx.db.insert("paragraphTranslationComments", {
      paragraphTranslationId: translation._id,
      parentCommentId: args.parentCommentId,
      body: text,
      authorName: identity?.name ?? identity?.email ?? "Anonymous editor",
      authorTokenIdentifier: identity?.tokenIdentifier,
      createdAt: now,
    });
    return { commentId };
  },
});

export const restoreRevision = mutation({
  args: {
    paragraphId: v.id("sermonParagraphs"),
    languageCode: v.string(),
    revisionId: v.id("paragraphTranslationRevisions"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const paragraph = await ctx.db.get(args.paragraphId);
    if (!paragraph) {
      throw new Error("Paragraph not found");
    }

    const translation = await ensureTranslationForParagraph(ctx, paragraph, args.languageCode);

    const revision = await ctx.db.get(args.revisionId);
    if (!revision || revision.paragraphTranslationId !== translation._id) {
      throw new Error("Revision not found for paragraph translation");
    }

    const identity = await ctx.auth.getUserIdentity();
    const now = Date.now();

    await ctx.db.patch(translation._id, {
      translatedText: revision.snapshotText,
      status: revision.status,
      updatedAt: now,
    });

    const createdRevisionId = await ctx.db.insert("paragraphTranslationRevisions", {
      paragraphTranslationId: translation._id,
      snapshotText: revision.snapshotText,
      status: revision.status,
      kind: "restore",
      reason: args.reason ?? "Restored revision",
      restoredFromRevisionId: args.revisionId,
      authorName: identity?.name ?? identity?.email ?? "Anonymous editor",
      authorTokenIdentifier: identity?.tokenIdentifier,
      createdAt: now,
    });

    return { revisionId: createdRevisionId };
  },
});

export const backfillParagraphTranslationsNb = mutation({
  args: {},
  handler: async (ctx) => {
    const paragraphs = await ctx.db.query("sermonParagraphs").collect();
    let created = 0;
    let existing = 0;

    for (const paragraph of paragraphs) {
      const translation = await ctx.db
        .query("sermonParagraphTranslations")
        .withIndex("by_paragraphId_and_languageCode", (q) =>
          q.eq("paragraphId", paragraph._id).eq("languageCode", "nb"),
        )
        .unique();

      if (translation) {
        existing += 1;
        continue;
      }

      const translationId = await ctx.db.insert("sermonParagraphTranslations", {
        paragraphId: paragraph._id,
        languageCode: "nb",
        translatedText: paragraph.translatedText,
        status: paragraph.status,
        updatedAt: paragraph.updatedAt,
      });

      await ctx.db.insert("paragraphTranslationRevisions", {
        paragraphTranslationId: translationId,
        snapshotText: paragraph.translatedText,
        status: paragraph.status,
        kind: "edit",
        reason: "Backfilled from legacy paragraph",
        authorName: "System",
        createdAt: Date.now(),
      });

      created += 1;
    }

    return { created, existing };
  },
});
