import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
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
const highlightColorValidator = v.union(
  v.literal("yellow"),
  v.literal("blue"),
  v.literal("green"),
  v.literal("red"),
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

async function requireIdentity(ctx: MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.tokenIdentifier) {
    throw new Error("Authentication required");
  }
  return identity;
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
    updatedAt: number;
  },
  languageCode: string,
) {
  const normalized = normalizeLanguageCode(languageCode);
  const existing = await findTranslationByParagraphAndLanguage(ctx, paragraph._id, normalized);
  if (existing) {
    return existing;
  }

  if (normalized === "nb") {
    throw new Error(`Missing canonical nb translation for paragraph ${paragraph._id}`);
  }

  const translationId = await ctx.db.insert("sermonParagraphTranslations", {
    paragraphId: paragraph._id,
    languageCode: normalized,
    translatedText: paragraph.sourceText,
    status: "draft",
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
        updatedAt: now,
      });

      const nbTranslationId = await ctx.db.insert("sermonParagraphTranslations", {
        paragraphId,
        languageCode: "nb",
        translatedText: pair.translatedText,
        status,
        updatedAt: now,
      });

      await ctx.db.insert("paragraphTranslationRevisions", {
        paragraphTranslationId: nbTranslationId,
        snapshotText: pair.translatedText,
        status,
        kind: "edit",
        reason: "Initial seed",
        authorName: "System",
        createdAt: now,
      });

      if (normalizedLanguage === "nb") {
        continue;
      }

      const translationId = await ctx.db.insert("sermonParagraphTranslations", {
        paragraphId,
        languageCode: normalizedLanguage,
        translatedText: pair.sourceText,
        status: "draft",
        updatedAt: now,
      });

      await ctx.db.insert("paragraphTranslationRevisions", {
        paragraphTranslationId: translationId,
        snapshotText: pair.sourceText,
        status: "draft",
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

export const listRevertBaselines = query({
  args: {
    sermonId: v.id("sermons"),
    languageCode: v.string(),
  },
  handler: async (ctx, args) => {
    const normalizedLanguage = normalizeLanguageCode(args.languageCode);
    const paragraphs = await ctx.db
      .query("sermonParagraphs")
      .withIndex("by_sermonId_and_order", (q) => q.eq("sermonId", args.sermonId))
      .take(500);

    const baselines = await Promise.all(
      paragraphs.map(async (paragraph) => {
        const translation = await ctx.db
          .query("sermonParagraphTranslations")
          .withIndex("by_paragraphId_and_languageCode", (q) =>
            q.eq("paragraphId", paragraph._id).eq("languageCode", normalizedLanguage),
          )
          .unique();

        if (!translation) {
          return {
            paragraphId: paragraph._id,
            targetText: paragraph.sourceText,
          };
        }

        const revisionsDesc = ctx.db
          .query("paragraphTranslationRevisions")
          .withIndex("by_paragraphTranslationId_and_createdAt", (q) =>
            q.eq("paragraphTranslationId", translation._id),
          )
          .order("desc");

        for await (const revision of revisionsDesc) {
          if (revision.status === "approved") {
            return {
              paragraphId: paragraph._id,
              targetText: revision.snapshotText,
            };
          }
        }

        const firstRevision = await ctx.db
          .query("paragraphTranslationRevisions")
          .withIndex("by_paragraphTranslationId_and_createdAt", (q) =>
            q.eq("paragraphTranslationId", translation._id),
          )
          .order("asc")
          .take(1);

        return {
          paragraphId: paragraph._id,
          targetText: firstRevision[0]?.snapshotText ?? translation.translatedText,
        };
      }),
    );

    return baselines;
  },
});

export const getEditorToolbarPrefs = query({
  args: {
    sermonId: v.id("sermons"),
    languageCode: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.tokenIdentifier) {
      return {
        canPersist: false,
        fontSizePx: null,
        bookmarked: null,
      };
    }

    const prefs = await ctx.db
      .query("editorToolbarPrefs")
      .withIndex("by_sermonId_and_languageCode_and_userTokenIdentifier", (q) =>
        q
          .eq("sermonId", args.sermonId)
          .eq("languageCode", normalizeLanguageCode(args.languageCode))
          .eq("userTokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    return {
      canPersist: true,
      fontSizePx: prefs?.fontSizePx ?? null,
      bookmarked: prefs?.bookmarked ?? null,
    };
  },
});

export const setEditorToolbarPrefs = mutation({
  args: {
    sermonId: v.id("sermons"),
    languageCode: v.string(),
    fontSizePx: v.optional(v.number()),
    bookmarked: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const normalizedLanguage = normalizeLanguageCode(args.languageCode);
    const now = Date.now();

    const existing = await ctx.db
      .query("editorToolbarPrefs")
      .withIndex("by_sermonId_and_languageCode_and_userTokenIdentifier", (q) =>
        q
          .eq("sermonId", args.sermonId)
          .eq("languageCode", normalizedLanguage)
          .eq("userTokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    const nextFontSize = args.fontSizePx ?? existing?.fontSizePx ?? 16;
    const nextBookmarked = args.bookmarked ?? existing?.bookmarked ?? false;

    if (existing) {
      await ctx.db.patch(existing._id, {
        fontSizePx: nextFontSize,
        bookmarked: nextBookmarked,
        updatedAt: now,
      });
      return { ok: true };
    }

    await ctx.db.insert("editorToolbarPrefs", {
      sermonId: args.sermonId,
      languageCode: normalizedLanguage,
      userTokenIdentifier: identity.tokenIdentifier,
      fontSizePx: nextFontSize,
      bookmarked: nextBookmarked,
      updatedAt: now,
    });

    return { ok: true };
  },
});

export const listSelectionHighlights = query({
  args: {
    sermonId: v.id("sermons"),
    languageCode: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.tokenIdentifier) {
      return {
        canPersist: false,
        highlights: [],
      };
    }

    const normalizedLanguage = normalizeLanguageCode(args.languageCode);
    const highlights = await ctx.db
      .query("paragraphSelectionHighlights")
      .withIndex("by_sermonId_and_languageCode_and_userTokenIdentifier", (q) =>
        q
          .eq("sermonId", args.sermonId)
          .eq("languageCode", normalizedLanguage)
          .eq("userTokenIdentifier", identity.tokenIdentifier),
      )
      .take(2000);

    const result: Array<{
      _id: Id<"paragraphSelectionHighlights">;
      paragraphId: Id<"sermonParagraphs">;
      color: "yellow" | "blue" | "green" | "red";
      startOffset: number;
      endOffset: number;
      selectedText: string;
    }> = [];

    for (const highlight of highlights) {
      const translation = await ctx.db
        .query("sermonParagraphTranslations")
        .withIndex("by_paragraphId_and_languageCode", (q) =>
          q.eq("paragraphId", highlight.paragraphId).eq("languageCode", normalizedLanguage),
        )
        .unique();
      const text = translation?.translatedText ?? "";
      if (
        highlight.startOffset >= 0 &&
        highlight.endOffset > highlight.startOffset &&
        highlight.endOffset <= text.length &&
        text.slice(highlight.startOffset, highlight.endOffset) === highlight.selectedText
      ) {
        result.push({
          _id: highlight._id,
          paragraphId: highlight.paragraphId,
          color: highlight.color,
          startOffset: highlight.startOffset,
          endOffset: highlight.endOffset,
          selectedText: highlight.selectedText,
        });
      }
    }

    return {
      canPersist: true,
      highlights: result,
    };
  },
});

export const createSelectionHighlight = mutation({
  args: {
    paragraphId: v.id("sermonParagraphs"),
    languageCode: v.string(),
    color: highlightColorValidator,
    startOffset: v.number(),
    endOffset: v.number(),
    selectedText: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const normalizedLanguage = normalizeLanguageCode(args.languageCode);
    const paragraph = await ctx.db.get(args.paragraphId);
    if (!paragraph) {
      throw new Error("Paragraph not found");
    }
    const translation = await ensureTranslationForParagraph(ctx, paragraph, normalizedLanguage);

    if (args.startOffset < 0 || args.endOffset <= args.startOffset || args.endOffset > translation.translatedText.length) {
      throw new Error("Invalid text selection offsets");
    }
    if (translation.translatedText.slice(args.startOffset, args.endOffset) !== args.selectedText) {
      throw new Error("Selected text no longer matches paragraph content");
    }

    const now = Date.now();
    const highlightId = await ctx.db.insert("paragraphSelectionHighlights", {
      sermonId: paragraph.sermonId,
      paragraphId: args.paragraphId,
      languageCode: normalizedLanguage,
      userTokenIdentifier: identity.tokenIdentifier,
      color: args.color,
      startOffset: args.startOffset,
      endOffset: args.endOffset,
      selectedText: args.selectedText,
      createdAt: now,
    });
    return { highlightId };
  },
});

export const deleteSelectionHighlight = mutation({
  args: {
    highlightId: v.id("paragraphSelectionHighlights"),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const highlight = await ctx.db.get(args.highlightId);
    if (!highlight) return { ok: true };
    if (highlight.userTokenIdentifier !== identity.tokenIdentifier) {
      throw new Error("Unauthorized");
    }
    await ctx.db.delete(args.highlightId);
    return { ok: true };
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

export const revertParagraphToLastApproved = mutation({
  args: {
    paragraphId: v.id("sermonParagraphs"),
    languageCode: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const paragraph = await ctx.db.get(args.paragraphId);
    if (!paragraph) {
      throw new Error("Paragraph not found");
    }

    const translation = await ensureTranslationForParagraph(ctx, paragraph, args.languageCode);

    let targetRevision: Doc<"paragraphTranslationRevisions"> | null = null;
    const revisionsDesc = ctx.db
      .query("paragraphTranslationRevisions")
      .withIndex("by_paragraphTranslationId_and_createdAt", (q) =>
        q.eq("paragraphTranslationId", translation._id),
      )
      .order("desc");

    for await (const revision of revisionsDesc) {
      if (revision.status === "approved") {
        targetRevision = revision;
        break;
      }
    }

    if (!targetRevision) {
      // Fallback: treat the first stored draft snapshot as the approved baseline.
      const revisionsAsc = ctx.db
        .query("paragraphTranslationRevisions")
        .withIndex("by_paragraphTranslationId_and_createdAt", (q) =>
          q.eq("paragraphTranslationId", translation._id),
        )
        .order("asc");
      for await (const revision of revisionsAsc) {
        targetRevision = revision;
        break;
      }
    }

    if (!targetRevision) {
      throw new Error("No revision history found for paragraph translation");
    }

    const identity = await ctx.auth.getUserIdentity();
    const now = Date.now();

    await ctx.db.patch(translation._id, {
      translatedText: targetRevision.snapshotText,
      updatedAt: now,
    });

    await ctx.db.insert("paragraphTranslationRevisions", {
      paragraphTranslationId: translation._id,
      snapshotText: targetRevision.snapshotText,
      status: translation.status,
      kind: "restore",
      reason: args.reason ?? "Reverted to last approved translation",
      restoredFromRevisionId: targetRevision._id,
      authorName: identity?.name ?? identity?.email ?? "Anonymous editor",
      authorTokenIdentifier: identity?.tokenIdentifier,
      createdAt: now,
    });

    return {
      ok: true,
      translatedText: targetRevision.snapshotText,
    };
  },
});

export const backfillParagraphTranslationsNb = mutation({
  args: {},
  handler: async (ctx) => {
    throw new Error(
      "Legacy backfill is no longer supported. Run editorial.assertNbTranslationIntegrity instead.",
    );
  },
});

export const listSermonIdsForNbIntegrity = internalQuery({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const page = await ctx.db.query("sermons").paginate(args.paginationOpts);

    return {
      isDone: page.isDone,
      continueCursor: page.continueCursor,
      page: page.page.map((sermon) => sermon._id),
    };
  },
});

export const verifyNbTranslationsForSermon = internalMutation({
  args: {
    sermonId: v.id("sermons"),
    sampleLimit: v.number(),
  },
  handler: async (ctx, args) => {
    const paragraphs = await ctx.db
      .query("sermonParagraphs")
      .withIndex("by_sermonId_and_order", (q) => q.eq("sermonId", args.sermonId))
      .take(5000);

    const missingParagraphIds: Id<"sermonParagraphs">[] = [];
    for (const paragraph of paragraphs) {
      const translation = await ctx.db
        .query("sermonParagraphTranslations")
        .withIndex("by_paragraphId_and_languageCode", (q) =>
          q.eq("paragraphId", paragraph._id).eq("languageCode", "nb"),
        )
        .unique();

      if (!translation) {
        missingParagraphIds.push(paragraph._id);
      }
      if (missingParagraphIds.length >= args.sampleLimit) {
        break;
      }
    }

    return {
      paragraphsChecked: paragraphs.length,
      missingParagraphIds,
    };
  },
});

export const assertNbTranslationIntegrity = action({
  args: {
    sampleLimit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const sampleLimit = Math.max(1, Math.min(args.sampleLimit ?? 100, 1000));
    const missingParagraphIds: Id<"sermonParagraphs">[] = [];
    let cursor: string | null = null;
    let sermonsChecked = 0;
    let paragraphsChecked = 0;

    do {
      const sermonPage: {
        isDone: boolean;
        continueCursor: string;
        page: Id<"sermons">[];
      } = await ctx.runQuery(internal.editorial.listSermonIdsForNbIntegrity, {
        paginationOpts: { cursor, numItems: 100 },
      });

      for (const sermonId of sermonPage.page) {
        const verification: {
          paragraphsChecked: number;
          missingParagraphIds: Id<"sermonParagraphs">[];
        } = await ctx.runMutation(internal.editorial.verifyNbTranslationsForSermon, {
          sermonId,
          sampleLimit: sampleLimit - missingParagraphIds.length,
        });

        sermonsChecked += 1;
        paragraphsChecked += verification.paragraphsChecked;
        missingParagraphIds.push(...verification.missingParagraphIds);

        if (missingParagraphIds.length >= sampleLimit) {
          break;
        }
      }

      if (missingParagraphIds.length >= sampleLimit || sermonPage.isDone) {
        break;
      }
      cursor = sermonPage.continueCursor;
    } while (true);

    if (missingParagraphIds.length > 0) {
      throw new Error(
        `NB translation integrity failed. Missing paragraph IDs (${missingParagraphIds.length} sample): ${missingParagraphIds.join(", ")}`,
      );
    }

    return {
      ok: true,
      sermonsChecked,
      paragraphsChecked,
      missingCount: 0,
    };
  },
});

export const checkNbTranslationIntegrityChunk = action({
  args: {
    cursor: v.optional(v.string()),
    sermonBatchSize: v.optional(v.number()),
    sampleLimit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const sermonBatchSize = Math.max(1, Math.min(args.sermonBatchSize ?? 50, 200));
    const sampleLimit = Math.max(1, Math.min(args.sampleLimit ?? 50, 500));

    const sermonPage: {
      isDone: boolean;
      continueCursor: string;
      page: Id<"sermons">[];
    } = await ctx.runQuery(internal.editorial.listSermonIdsForNbIntegrity, {
      paginationOpts: { cursor: args.cursor ?? null, numItems: sermonBatchSize },
    });

    let paragraphsChecked = 0;
    const missingParagraphIds: Id<"sermonParagraphs">[] = [];

    for (const sermonId of sermonPage.page) {
      const verification: {
        paragraphsChecked: number;
        missingParagraphIds: Id<"sermonParagraphs">[];
      } = await ctx.runMutation(internal.editorial.verifyNbTranslationsForSermon, {
        sermonId,
        sampleLimit: sampleLimit - missingParagraphIds.length,
      });

      paragraphsChecked += verification.paragraphsChecked;
      missingParagraphIds.push(...verification.missingParagraphIds);

      if (missingParagraphIds.length >= sampleLimit) {
        break;
      }
    }

    return {
      cursor: sermonPage.isDone ? null : sermonPage.continueCursor,
      isDone: sermonPage.isDone,
      sermonsChecked: sermonPage.page.length,
      paragraphsChecked,
      missingParagraphIds,
      ok: sermonPage.isDone && missingParagraphIds.length === 0,
    };
  },
});

export const cleanupLegacyParagraphFields = mutation({
  args: {
    batchSize: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const batchSize = Math.max(1, Math.min(args.batchSize ?? 200, 1000));
    const page = await ctx.db
      .query("sermonParagraphs")
      .paginate({ cursor: args.cursor ?? null, numItems: batchSize });

    let cleaned = 0;
    for (const row of page.page) {
      await ctx.db.replace(row._id, {
        sermonId: row.sermonId,
        order: row.order,
        sourceText: row.sourceText,
        updatedAt: row.updatedAt,
      });
      cleaned += 1;
    }

    return {
      scanned: page.page.length,
      cleaned,
      hasMore: !page.isDone,
      isDone: page.isDone,
      nextCursor: page.isDone ? null : page.continueCursor,
    };
  },
});

export const cleanupLegacyParagraphFieldsUntilDone = action({
  args: {
    batchSize: v.optional(v.number()),
    maxBatches: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const batchSize = Math.max(1, Math.min(args.batchSize ?? 1000, 1000));
    const maxBatches = Math.max(1, Math.min(args.maxBatches ?? 200, 1000));

    let cursor: string | undefined = args.cursor;
    let batches = 0;
    let scanned = 0;
    let cleaned = 0;

    for (let i = 0; i < maxBatches; i += 1) {
      const result: {
        scanned: number;
        cleaned: number;
        hasMore: boolean;
        isDone: boolean;
        nextCursor: string | null;
      } = await ctx.runMutation(api.editorial.cleanupLegacyParagraphFields as any, {
        batchSize,
        cursor,
      });

      batches += 1;
      scanned += result.scanned;
      cleaned += result.cleaned;
      cursor = result.nextCursor ?? undefined;

      if (result.isDone) {
        return {
          done: true,
          batches,
          scanned,
          cleaned,
          nextCursor: null,
        };
      }
    }

    return {
      done: false,
      batches,
      scanned,
      cleaned,
      nextCursor: cursor ?? null,
    };
  },
});

export const repairMissingNbTranslations = mutation({
  args: {
    paragraphIds: v.array(v.id("sermonParagraphs")),
    fromLanguageCode: v.optional(v.string()),
    allowSourceTextFallback: v.optional(v.boolean()),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const dryRun = args.dryRun ?? false;
    const allowSourceTextFallback = args.allowSourceTextFallback ?? false;
    const requestedSourceRaw = args.fromLanguageCode?.trim().toLowerCase() ?? null;
    const useParagraphSource = requestedSourceRaw === "source";
    const requestedSourceLanguage = requestedSourceRaw && !useParagraphSource
      ? normalizeLanguageCode(requestedSourceRaw)
      : null;

    if (requestedSourceLanguage === "nb") {
      throw new Error("fromLanguageCode cannot be nb");
    }

    const fallbackSourceLanguages = requestedSourceLanguage
      ? [requestedSourceLanguage]
      : ["en", "no", "nn", "sv", "da", "de", "fr", "es"];

    const notFoundParagraphIds: Id<"sermonParagraphs">[] = [];
    const alreadyPresentParagraphIds: Id<"sermonParagraphs">[] = [];
    const missingSourceParagraphIds: Id<"sermonParagraphs">[] = [];
    const missingSourceDetails: Array<{
      paragraphId: Id<"sermonParagraphs">;
      sermonId: Id<"sermons">;
      sermonTag: string | null;
      order: number;
      availableLanguages: string[];
    }> = [];
    const repairedParagraphIds: Id<"sermonParagraphs">[] = [];
    const repairedDetails: Array<{
      paragraphId: Id<"sermonParagraphs">;
      sermonId: Id<"sermons">;
      sermonTag: string | null;
      order: number;
      sourceLanguage: string;
    }> = [];

    for (const paragraphId of args.paragraphIds) {
      const paragraph = await ctx.db.get(paragraphId);
      if (!paragraph) {
        notFoundParagraphIds.push(paragraphId);
        continue;
      }

      const existingNb = await ctx.db
        .query("sermonParagraphTranslations")
        .withIndex("by_paragraphId_and_languageCode", (q) =>
          q.eq("paragraphId", paragraphId).eq("languageCode", "nb"),
        )
        .unique();
      if (existingNb) {
        alreadyPresentParagraphIds.push(paragraphId);
        continue;
      }

      let sourceTranslation:
        | Doc<"sermonParagraphTranslations">
        | null = null;
      let sourceLanguage = "";

      if (!useParagraphSource) {
        for (const languageCode of fallbackSourceLanguages) {
          const candidate = await ctx.db
            .query("sermonParagraphTranslations")
            .withIndex("by_paragraphId_and_languageCode", (q) =>
              q.eq("paragraphId", paragraphId).eq("languageCode", languageCode),
            )
            .unique();
          if (candidate) {
            sourceTranslation = candidate;
            sourceLanguage = languageCode;
            break;
          }
        }
      }

      if (!sourceTranslation && !useParagraphSource && !allowSourceTextFallback) {
        missingSourceParagraphIds.push(paragraphId);
        const availableTranslations = await ctx.db
          .query("sermonParagraphTranslations")
          .withIndex("by_paragraphId_and_languageCode", (q) => q.eq("paragraphId", paragraphId))
          .take(100);
        const sermon = await ctx.db.get(paragraph.sermonId);
        missingSourceDetails.push({
          paragraphId,
          sermonId: paragraph.sermonId,
          sermonTag: sermon?.tag ?? null,
          order: paragraph.order,
          availableLanguages: availableTranslations.map((row) => row.languageCode),
        });
        continue;
      }

      const sermon = await ctx.db.get(paragraph.sermonId);
      const translatedText = sourceTranslation?.translatedText ?? paragraph.sourceText;
      const status = sourceTranslation?.status ?? "draft";
      sourceLanguage = sourceTranslation ? sourceLanguage : "source";

      if (!dryRun) {
        const insertedId = await ctx.db.insert("sermonParagraphTranslations", {
          paragraphId,
          languageCode: "nb",
          translatedText,
          status,
          updatedAt: now,
        });

        await ctx.db.insert("paragraphTranslationRevisions", {
          paragraphTranslationId: insertedId,
          snapshotText: translatedText,
          status,
          kind: "edit",
          reason: `Backfilled missing nb translation from ${sourceLanguage}`,
          authorName: "System",
          createdAt: now,
        });
      }

      repairedParagraphIds.push(paragraphId);
      repairedDetails.push({
        paragraphId,
        sermonId: paragraph.sermonId,
        sermonTag: sermon?.tag ?? null,
        order: paragraph.order,
        sourceLanguage,
      });
    }

    return {
      dryRun,
      requestedCount: args.paragraphIds.length,
      repairedCount: repairedParagraphIds.length,
      repairedParagraphIds,
      repairedDetails,
      alreadyPresentCount: alreadyPresentParagraphIds.length,
      alreadyPresentParagraphIds,
      missingSourceCount: missingSourceParagraphIds.length,
      missingSourceParagraphIds,
      missingSourceDetails,
      notFoundCount: notFoundParagraphIds.length,
      notFoundParagraphIds,
      ok:
        notFoundParagraphIds.length === 0 &&
        missingSourceParagraphIds.length === 0,
    };
  },
});
