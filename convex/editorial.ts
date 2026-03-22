import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

const paragraphStatusValidator = v.union(
  v.literal("draft"),
  v.literal("drafting"),
  v.literal("needs_review"),
  v.literal("approved"),
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

export const ensureParagraphsForSermon = mutation({
  args: { sermonId: v.id("sermons") },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("sermonParagraphs")
      .withIndex("by_sermonId_and_order", (q) => q.eq("sermonId", args.sermonId))
      .take(1);
    if (existing.length > 0) {
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
      const paragraphId = await ctx.db.insert("sermonParagraphs", {
        sermonId: args.sermonId,
        order: i + 1,
        sourceText: pair.sourceText,
        translatedText: pair.translatedText,
        status: i === 1 ? "drafting" : i === 0 ? "approved" : i === 2 ? "needs_review" : "draft",
        updatedAt: now,
      });

      await ctx.db.insert("paragraphRevisions", {
        paragraphId,
        snapshotText: pair.translatedText,
        status: i === 1 ? "drafting" : i === 0 ? "approved" : i === 2 ? "needs_review" : "draft",
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
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sermonParagraphs")
      .withIndex("by_sermonId_and_order", (q) => q.eq("sermonId", args.sermonId))
      .paginate(args.paginationOpts);
  },
});

export const listComments = query({
  args: {
    paragraphId: v.id("sermonParagraphs"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("paragraphComments")
      .withIndex("by_paragraphId_and_createdAt", (q) => q.eq("paragraphId", args.paragraphId))
      .paginate(args.paginationOpts);
  },
});

export const listRevisions = query({
  args: {
    paragraphId: v.id("sermonParagraphs"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("paragraphRevisions")
      .withIndex("by_paragraphId_and_createdAt", (q) => q.eq("paragraphId", args.paragraphId))
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

export const updateParagraphDraft = mutation({
  args: {
    paragraphId: v.id("sermonParagraphs"),
    translatedText: v.string(),
    reason: v.optional(v.string()),
    submitForReview: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const paragraph = await ctx.db.get(args.paragraphId);
    if (!paragraph) {
      throw new Error("Paragraph not found");
    }

    const identity = await ctx.auth.getUserIdentity();
    const now = Date.now();
    const normalized = args.translatedText.trim();
    const nextText = normalized.length > 0 ? normalized : paragraph.translatedText;
    const nextStatus = args.submitForReview ? "needs_review" : "drafting";

    await ctx.db.patch(args.paragraphId, {
      translatedText: nextText,
      status: nextStatus,
      updatedAt: now,
    });

    await ctx.db.insert("paragraphRevisions", {
      paragraphId: args.paragraphId,
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
    status: paragraphStatusValidator,
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const paragraph = await ctx.db.get(args.paragraphId);
    if (!paragraph) {
      throw new Error("Paragraph not found");
    }

    const identity = await ctx.auth.getUserIdentity();
    const now = Date.now();

    await ctx.db.patch(args.paragraphId, {
      status: args.status,
      updatedAt: now,
    });

    await ctx.db.insert("paragraphRevisions", {
      paragraphId: args.paragraphId,
      snapshotText: paragraph.translatedText,
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

export const addComment = mutation({
  args: {
    paragraphId: v.id("sermonParagraphs"),
    body: v.string(),
    parentCommentId: v.optional(v.id("paragraphComments")),
  },
  handler: async (ctx, args) => {
    const paragraph = await ctx.db.get(args.paragraphId);
    if (!paragraph) {
      throw new Error("Paragraph not found");
    }
    const text = args.body.trim();
    if (!text) {
      throw new Error("Comment cannot be empty");
    }
    const identity = await ctx.auth.getUserIdentity();
    const now = Date.now();
    const commentId = await ctx.db.insert("paragraphComments", {
      paragraphId: args.paragraphId,
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
    revisionId: v.id("paragraphRevisions"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const paragraph = await ctx.db.get(args.paragraphId);
    if (!paragraph) {
      throw new Error("Paragraph not found");
    }

    const revision = await ctx.db.get(args.revisionId);
    if (!revision || revision.paragraphId !== args.paragraphId) {
      throw new Error("Revision not found for paragraph");
    }

    const identity = await ctx.auth.getUserIdentity();
    const now = Date.now();

    await ctx.db.patch(args.paragraphId, {
      translatedText: revision.snapshotText,
      status: revision.status,
      updatedAt: now,
    });

    const createdRevisionId: Id<"paragraphRevisions"> = await ctx.db.insert("paragraphRevisions", {
      paragraphId: args.paragraphId,
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
