import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { DEFAULT_LOCALE, appendActivityLog, requireAccess } from "./_lib/platform";
import { computeDocumentStatus, isAllowedTransition } from "./_lib/workflowUtils";

const statusValidator = v.union(
  v.literal("draft"),
  v.literal("drafting"),
  v.literal("needs_review"),
  v.literal("approved"),
  v.literal("blocked"),
);

export const getProgress = query({
  args: {
    documentId: v.id("documents"),
    locale: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAccess(ctx, "viewer");
    const locale = args.locale ?? DEFAULT_LOCALE;
    const rows = await ctx.db
      .query("workflowStates")
      .withIndex("by_documentId_and_level_and_locale", (q) =>
        q.eq("documentId", args.documentId).eq("level", "segment").eq("locale", locale),
      )
      .collect();

    const counts = {
      draft: 0,
      drafting: 0,
      needs_review: 0,
      approved: 0,
      blocked: 0,
    };
    for (const row of rows) {
      if (row.status in counts) {
        counts[row.status as keyof typeof counts] += 1;
      }
    }
    const total = rows.length;
    const completion = total === 0 ? 0 : Math.round((counts.approved / total) * 100);
    return { counts, total, completion };
  },
});

export const transitionSegmentStatus = mutation({
  args: {
    segmentId: v.id("segments"),
    locale: v.optional(v.string()),
    toStatus: statusValidator,
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const minimumRole = args.toStatus === "approved" ? "reviewer" : "editor";
    const { user, role } = await requireAccess(ctx, minimumRole);
    const segment = await ctx.db.get(args.segmentId);
    if (!segment) throw new Error("Segment not found");
    const locale = args.locale ?? DEFAULT_LOCALE;
    const now = Date.now();

    const state = await ctx.db
      .query("workflowStates")
      .withIndex("by_segmentId_and_locale", (q) => q.eq("segmentId", segment._id).eq("locale", locale))
      .unique();
    if (!state) throw new Error("Workflow state not found");

    const document = await ctx.db.get(segment.documentId);
    if (!document) throw new Error("Document not found");
    const template = await ctx.db.get(document.workflowTemplateId);
    if (!template) throw new Error("Workflow template not found");

    const allowed = isAllowedTransition(template.transitions, state.status, args.toStatus, role.name);

    if (!allowed && args.toStatus !== state.status) {
      throw new Error("CONFLICT");
    }

    await ctx.db.patch(state._id, {
      status: args.toStatus,
      updatedByUserId: user._id,
      updatedAt: now,
    });

    const translation = await ctx.db
      .query("translations")
      .withIndex("by_segmentId_and_locale", (q) => q.eq("segmentId", segment._id).eq("locale", locale))
      .unique();
    if (translation) {
      await ctx.db.patch(translation._id, {
        status: args.toStatus,
        updatedByUserId: user._id,
        updatedAt: now,
      });
    }

    const allSegmentStates = await ctx.db
      .query("workflowStates")
      .withIndex("by_documentId_and_level_and_locale", (q) =>
        q.eq("documentId", segment.documentId).eq("level", "segment").eq("locale", locale),
      )
      .collect();
    const documentStatus = computeDocumentStatus(allSegmentStates.map((row) => row.status));

    const documentState = await ctx.db
      .query("workflowStates")
      .withIndex("by_documentId_and_level_and_locale", (q) =>
        q.eq("documentId", segment.documentId).eq("level", "document").eq("locale", locale),
      )
      .unique();
    if (documentState) {
      await ctx.db.patch(documentState._id, {
        status: documentStatus,
        updatedByUserId: user._id,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("workflowStates", {
        tenantId: segment.tenantId,
        workflowTemplateId: document.workflowTemplateId,
        documentId: segment.documentId,
        segmentId: undefined,
        locale,
        level: "document",
        status: documentStatus,
        updatedByUserId: user._id,
        updatedAt: now,
      });
    }

    await ctx.db.patch(document._id, {
      status: documentStatus,
      updatedAt: now,
    });

    await appendActivityLog(ctx, {
      actorUserId: user._id,
      action: "workflow.segment_transition",
      entityType: "workflowState",
      entityId: String(state._id),
      documentId: segment.documentId,
      segmentId: segment._id,
      reason: args.reason,
      metadata: { fromStatus: state.status, toStatus: args.toStatus, locale },
    });

    return { ok: true, documentStatus };
  },
});
