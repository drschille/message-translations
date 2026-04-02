import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const paragraphStatus = v.union(
  v.literal("draft"),
  v.literal("drafting"),
  v.literal("needs_review"),
  v.literal("approved"),
);

const sermonProofreadingState = v.union(
  v.literal("queued"),
  v.literal("in_progress"),
  v.literal("done"),
);
const highlightColor = v.union(
  v.literal("yellow"),
  v.literal("blue"),
  v.literal("green"),
  v.literal("red"),
);

export default defineSchema({
  appMetrics: defineTable({
    key: v.string(),
    value: v.number(),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),
  sermons: defineTable({
    title: v.string(),
    date: v.string(), // ISO format or "DD MMM YYYY"
    description: v.string(),
    tag: v.optional(v.string()),
    location: v.optional(v.string()),
    scripture: v.optional(v.string()),
    audioUrl: v.optional(v.string()),
    pdfUrl: v.optional(v.string()),
    transcript: v.optional(v.string()),
    series: v.optional(v.string()),
    proofreadingState: v.optional(sermonProofreadingState),
    isPublished: v.optional(v.boolean()),
    currentVersion: v.optional(v.number()),
    lastPublishedAt: v.optional(v.number()),
  })
    .index("by_date", ["date"])
    .index("by_tag", ["tag"])
    .index("by_proofreadingState", ["proofreadingState"])
    .index("by_isPublished", ["isPublished"]),
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
  sermonMetadataTranslations: defineTable({
    sermonId: v.id("sermons"),
    languageCode: v.string(),
    title: v.string(),
    description: v.string(),
    updatedAt: v.number(),
  })
    .index("by_sermonId_and_languageCode", ["sermonId", "languageCode"])
    .index("by_languageCode", ["languageCode"]),
  sermonParagraphTranslations: defineTable({
    paragraphId: v.id("sermonParagraphs"),
    languageCode: v.string(),
    translatedText: v.string(),
    status: paragraphStatus,
    updatedAt: v.number(),
  })
    .index("by_paragraphId_and_languageCode", ["paragraphId", "languageCode"])
    .index("by_languageCode_and_status", ["languageCode", "status"]),
  paragraphTranslationComments: defineTable({
    paragraphTranslationId: v.id("sermonParagraphTranslations"),
    parentCommentId: v.optional(v.id("paragraphTranslationComments")),
    body: v.string(),
    authorName: v.string(),
    authorTokenIdentifier: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_paragraphTranslationId_and_createdAt", ["paragraphTranslationId", "createdAt"]),
  paragraphTranslationRevisions: defineTable({
    paragraphTranslationId: v.id("sermonParagraphTranslations"),
    snapshotText: v.string(),
    status: paragraphStatus,
    kind: v.union(v.literal("edit"), v.literal("restore")),
    reason: v.optional(v.string()),
    restoredFromRevisionId: v.optional(v.id("paragraphTranslationRevisions")),
    authorName: v.string(),
    authorTokenIdentifier: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_paragraphTranslationId_and_createdAt", ["paragraphTranslationId", "createdAt"]),
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
  sermonPublishedVersions: defineTable({
    sermonId: v.id("sermons"),
    version: v.number(),
    languageCode: v.string(),
    proofreadingState: sermonProofreadingState,
    publishedAt: v.number(),
    reason: v.optional(v.string()),
    authorName: v.string(),
    authorTokenIdentifier: v.optional(v.string()),
  })
    .index("by_sermonId_and_version", ["sermonId", "version"])
    .index("by_sermonId_and_publishedAt", ["sermonId", "publishedAt"]),
  sermonPublishedParagraphSnapshots: defineTable({
    publishedVersionId: v.id("sermonPublishedVersions"),
    paragraphId: v.id("sermonParagraphs"),
    order: v.number(),
    sourceText: v.string(),
    translatedText: v.string(),
    status: paragraphStatus,
  }).index("by_publishedVersionId_and_order", ["publishedVersionId", "order"]),
  editorToolbarPrefs: defineTable({
    sermonId: v.id("sermons"),
    languageCode: v.string(),
    userTokenIdentifier: v.string(),
    fontSizePx: v.number(),
    bookmarked: v.boolean(),
    updatedAt: v.number(),
  }).index("by_sermonId_and_languageCode_and_userTokenIdentifier", [
    "sermonId",
    "languageCode",
    "userTokenIdentifier",
  ]),
  paragraphSelectionHighlights: defineTable({
    sermonId: v.id("sermons"),
    paragraphId: v.id("sermonParagraphs"),
    languageCode: v.string(),
    userTokenIdentifier: v.string(),
    color: highlightColor,
    startOffset: v.number(),
    endOffset: v.number(),
    selectedText: v.string(),
    createdAt: v.number(),
  })
    .index("by_sermonId_and_languageCode_and_userTokenIdentifier", [
      "sermonId",
      "languageCode",
      "userTokenIdentifier",
    ])
    .index("by_paragraphId_and_languageCode_and_userTokenIdentifier", [
      "paragraphId",
      "languageCode",
      "userTokenIdentifier",
    ]),
});
