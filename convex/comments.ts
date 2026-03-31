import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { DEFAULT_LOCALE, appendActivityLog, requireAccess } from "./_lib/platform";

export const listBySegment = query({
  args: {
    segmentId: v.id("segments"),
    locale: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    await requireAccess(ctx, "viewer");
    const locale = args.locale ?? DEFAULT_LOCALE;
    return await ctx.db
      .query("comments")
      .withIndex("by_segmentId_and_locale_and_createdAt", (q) =>
        q.eq("segmentId", args.segmentId).eq("locale", locale),
      )
      .paginate(args.paginationOpts);
  },
});

export const add = mutation({
  args: {
    segmentId: v.id("segments"),
    locale: v.optional(v.string()),
    body: v.string(),
    parentCommentId: v.optional(v.id("comments")),
  },
  handler: async (ctx, args) => {
    const { user } = await requireAccess(ctx, "editor");
    const segment = await ctx.db.get(args.segmentId);
    if (!segment) throw new Error("Segment not found");
    const locale = args.locale ?? DEFAULT_LOCALE;
    const body = args.body.trim();
    if (!body) throw new Error("Comment cannot be empty");
    const now = Date.now();

    let rootCommentId = args.parentCommentId;
    if (args.parentCommentId) {
      const parent = await ctx.db.get(args.parentCommentId);
      if (!parent) throw new Error("Parent comment not found");
      rootCommentId = parent.rootCommentId ?? parent._id;
    }

    const commentId = await ctx.db.insert("comments", {
      tenantId: segment.tenantId,
      documentId: segment.documentId,
      segmentId: segment._id,
      locale,
      rootCommentId: rootCommentId ?? undefined,
      parentCommentId: args.parentCommentId,
      body,
      status: "open",
      authorUserId: user._id,
      resolvedByUserId: undefined,
      resolvedAt: undefined,
      createdAt: now,
      updatedAt: now,
    });

    await appendActivityLog(ctx, {
      actorUserId: user._id,
      action: "comment.added",
      entityType: "comment",
      entityId: String(commentId),
      documentId: segment.documentId,
      segmentId: segment._id,
      commentId,
      metadata: { locale },
    });

    return { commentId };
  },
});

export const setResolved = mutation({
  args: {
    commentId: v.id("comments"),
    resolved: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { user } = await requireAccess(ctx, "reviewer");
    const comment = await ctx.db.get(args.commentId);
    if (!comment) throw new Error("Comment not found");
    const now = Date.now();
    const nextStatus = args.resolved ? "resolved" : "open";

    await ctx.db.patch(comment._id, {
      status: nextStatus,
      resolvedByUserId: args.resolved ? user._id : undefined,
      resolvedAt: args.resolved ? now : undefined,
      updatedAt: now,
    });

    await appendActivityLog(ctx, {
      actorUserId: user._id,
      action: args.resolved ? "comment.resolved" : "comment.reopened",
      entityType: "comment",
      entityId: String(comment._id),
      documentId: comment.documentId,
      segmentId: comment.segmentId,
      commentId: comment._id,
      metadata: {
        fromStatus: comment.status,
        toStatus: nextStatus,
        locale: comment.locale,
      },
    });

    return { ok: true };
  },
});

