import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const paragraphStatus = v.union(
  v.literal("draft"),
  v.literal("drafting"),
  v.literal("needs_review"),
  v.literal("approved"),
);

const roleName = v.union(
  v.literal("owner"),
  v.literal("admin"),
  v.literal("editor"),
  v.literal("reviewer"),
  v.literal("viewer"),
);

const workflowStatus = v.union(
  v.literal("draft"),
  v.literal("drafting"),
  v.literal("needs_review"),
  v.literal("approved"),
  v.literal("blocked"),
);

export default defineSchema({
  tenants: defineTable({
    key: v.string(),
    name: v.string(),
    region: v.optional(v.string()),
    active: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_key", ["key"])
    .index("by_active_and_updatedAt", ["active", "updatedAt"]),
  users: defineTable({
    tokenIdentifier: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_tokenIdentifier", ["tokenIdentifier"])
    .index("by_email", ["email"]),
  roles: defineTable({
    tenantId: v.id("tenants"),
    name: roleName,
    description: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_tenantId_and_name", ["tenantId", "name"]),
  memberships: defineTable({
    tenantId: v.id("tenants"),
    userId: v.id("users"),
    roleId: v.id("roles"),
    active: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_tenantId_and_userId", ["tenantId", "userId"])
    .index("by_userId_and_active", ["userId", "active"]),
  workflowTemplates: defineTable({
    tenantId: v.id("tenants"),
    name: v.string(),
    isDefault: v.boolean(),
    statuses: v.array(v.string()),
    transitions: v.array(
      v.object({
        from: v.string(),
        to: v.string(),
        rolesAllowed: v.array(v.string()),
      }),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_tenantId_and_name", ["tenantId", "name"])
    .index("by_tenantId_and_isDefault", ["tenantId", "isDefault"]),
  documents: defineTable({
    tenantId: v.id("tenants"),
    workflowTemplateId: v.id("workflowTemplates"),
    title: v.string(),
    sourceLanguage: v.string(),
    sourceText: v.optional(v.string()),
    useCase: v.string(),
    externalRef: v.optional(v.string()),
    status: workflowStatus,
    metadata: v.optional(
      v.object({
        sourceSystem: v.optional(v.string()),
        sourceId: v.optional(v.string()),
        summary: v.optional(v.string()),
        series: v.optional(v.string()),
        date: v.optional(v.string()),
        tags: v.optional(v.array(v.string())),
      }),
    ),
    createdByUserId: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_tenantId_and_useCase_and_updatedAt", ["tenantId", "useCase", "updatedAt"])
    .index("by_tenantId_and_externalRef", ["tenantId", "externalRef"])
    .index("by_tenantId_and_status", ["tenantId", "status"]),
  documentLocales: defineTable({
    tenantId: v.id("tenants"),
    documentId: v.id("documents"),
    locale: v.string(),
    enabled: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_documentId_and_locale", ["documentId", "locale"])
    .index("by_tenantId_and_locale", ["tenantId", "locale"]),
  segments: defineTable({
    tenantId: v.id("tenants"),
    documentId: v.id("documents"),
    stableKey: v.string(),
    order: v.number(),
    sourceText: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_documentId_and_order", ["documentId", "order"])
    .index("by_documentId_and_stableKey", ["documentId", "stableKey"]),
  translations: defineTable({
    tenantId: v.id("tenants"),
    documentId: v.id("documents"),
    segmentId: v.id("segments"),
    locale: v.string(),
    activeVersionId: v.optional(v.id("translationVersions")),
    text: v.string(),
    status: workflowStatus,
    updatedByUserId: v.id("users"),
    updatedAt: v.number(),
  })
    .index("by_segmentId_and_locale", ["segmentId", "locale"])
    .index("by_documentId_and_locale", ["documentId", "locale"])
    .index("by_documentId_and_status", ["documentId", "status"]),
  translationVersions: defineTable({
    tenantId: v.id("tenants"),
    documentId: v.id("documents"),
    segmentId: v.id("segments"),
    translationId: v.id("translations"),
    locale: v.string(),
    text: v.string(),
    status: workflowStatus,
    kind: v.union(v.literal("edit"), v.literal("restore"), v.literal("import")),
    previousVersionId: v.optional(v.id("translationVersions")),
    restoredFromVersionId: v.optional(v.id("translationVersions")),
    reason: v.optional(v.string()),
    actorUserId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_translationId_and_createdAt", ["translationId", "createdAt"])
    .index("by_segmentId_and_locale_and_createdAt", ["segmentId", "locale", "createdAt"]),
  comments: defineTable({
    tenantId: v.id("tenants"),
    documentId: v.id("documents"),
    segmentId: v.id("segments"),
    locale: v.string(),
    rootCommentId: v.optional(v.id("comments")),
    parentCommentId: v.optional(v.id("comments")),
    body: v.string(),
    status: v.union(v.literal("open"), v.literal("resolved")),
    authorUserId: v.id("users"),
    resolvedByUserId: v.optional(v.id("users")),
    resolvedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_segmentId_and_locale_and_createdAt", ["segmentId", "locale", "createdAt"])
    .index("by_documentId_and_status", ["documentId", "status"])
    .index("by_parentCommentId_and_createdAt", ["parentCommentId", "createdAt"]),
  workflowStates: defineTable({
    tenantId: v.id("tenants"),
    workflowTemplateId: v.id("workflowTemplates"),
    documentId: v.id("documents"),
    segmentId: v.optional(v.id("segments")),
    locale: v.string(),
    level: v.union(v.literal("document"), v.literal("segment")),
    status: workflowStatus,
    updatedByUserId: v.id("users"),
    updatedAt: v.number(),
  })
    .index("by_documentId_and_level_and_locale", ["documentId", "level", "locale"])
    .index("by_segmentId_and_locale", ["segmentId", "locale"])
    .index("by_documentId_and_status", ["documentId", "status"]),
  activityLog: defineTable({
    tenantId: v.id("tenants"),
    actorUserId: v.id("users"),
    action: v.string(),
    entityType: v.string(),
    entityId: v.string(),
    documentId: v.optional(v.id("documents")),
    segmentId: v.optional(v.id("segments")),
    translationId: v.optional(v.id("translations")),
    commentId: v.optional(v.id("comments")),
    reason: v.optional(v.string()),
    metadata: v.optional(
      v.object({
        fromStatus: v.optional(v.string()),
        toStatus: v.optional(v.string()),
        locale: v.optional(v.string()),
      }),
    ),
    createdAt: v.number(),
  })
    .index("by_tenantId_and_createdAt", ["tenantId", "createdAt"])
    .index("by_documentId_and_createdAt", ["documentId", "createdAt"])
    .index("by_entityType_and_entityId_and_createdAt", ["entityType", "entityId", "createdAt"]),
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
  })
    .index("by_date", ["date"])
    .index("by_tag", ["tag"]),
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
});
