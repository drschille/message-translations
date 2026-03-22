import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const paragraphStatus = v.union(
  v.literal("draft"),
  v.literal("drafting"),
  v.literal("needs_review"),
  v.literal("approved"),
);

export default defineSchema({
  sermons: defineTable({
    title: v.string(),
    date: v.string(), // ISO format or "DD MMM YYYY"
    description: v.string(),
    scripture: v.optional(v.string()),
    audioUrl: v.optional(v.string()),
    pdfUrl: v.optional(v.string()),
    transcript: v.optional(v.string()),
    series: v.optional(v.string()),
  }).index("by_date", ["date"]),
  sermonParagraphs: defineTable({
    sermonId: v.id("sermons"),
    order: v.number(),
    sourceText: v.string(),
    translatedText: v.string(),
    status: paragraphStatus,
    updatedAt: v.number(),
  })
    .index("by_sermonId_and_order", ["sermonId", "order"])
    .index("by_sermonId_and_status", ["sermonId", "status"]),
  paragraphComments: defineTable({
    paragraphId: v.id("sermonParagraphs"),
    parentCommentId: v.optional(v.id("paragraphComments")),
    body: v.string(),
    authorName: v.string(),
    authorTokenIdentifier: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_paragraphId_and_createdAt", ["paragraphId", "createdAt"]),
  paragraphRevisions: defineTable({
    paragraphId: v.id("sermonParagraphs"),
    snapshotText: v.string(),
    status: paragraphStatus,
    kind: v.union(v.literal("edit"), v.literal("restore")),
    reason: v.optional(v.string()),
    restoredFromRevisionId: v.optional(v.id("paragraphRevisions")),
    authorName: v.string(),
    authorTokenIdentifier: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_paragraphId_and_createdAt", ["paragraphId", "createdAt"]),
});
