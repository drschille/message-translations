import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { query } from "./_generated/server";
import { DEFAULT_LOCALE, requireAccess } from "./_lib/platform";

export const listTranslationVersions = query({
  args: {
    segmentId: v.id("segments"),
    locale: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    await requireAccess(ctx, "viewer");
    const locale = args.locale ?? DEFAULT_LOCALE;
    return await ctx.db
      .query("translationVersions")
      .withIndex("by_segmentId_and_locale_and_createdAt", (q) =>
        q.eq("segmentId", args.segmentId).eq("locale", locale),
      )
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

export const listActivityByDocument = query({
  args: {
    documentId: v.id("documents"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    await requireAccess(ctx, "viewer");
    return await ctx.db
      .query("activityLog")
      .withIndex("by_documentId_and_createdAt", (q) => q.eq("documentId", args.documentId))
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

