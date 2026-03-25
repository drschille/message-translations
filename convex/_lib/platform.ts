import { QueryCtx, MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

export const DEFAULT_TENANT_KEY = "default";
export const DEFAULT_LOCALE = "nb";

const roleRank: Record<string, number> = {
  viewer: 1,
  editor: 2,
  reviewer: 3,
  admin: 4,
  owner: 5,
};

const DEFAULT_WORKFLOW_STATUSES = ["draft", "drafting", "needs_review", "approved", "blocked"];

const DEFAULT_WORKFLOW_TRANSITIONS = [
  { from: "draft", to: "drafting", rolesAllowed: ["editor", "reviewer", "admin", "owner"] },
  { from: "drafting", to: "needs_review", rolesAllowed: ["editor", "reviewer", "admin", "owner"] },
  { from: "needs_review", to: "approved", rolesAllowed: ["reviewer", "admin", "owner"] },
  { from: "needs_review", to: "drafting", rolesAllowed: ["reviewer", "admin", "owner"] },
  { from: "approved", to: "drafting", rolesAllowed: ["admin", "owner"] },
  { from: "drafting", to: "blocked", rolesAllowed: ["reviewer", "admin", "owner"] },
  { from: "blocked", to: "drafting", rolesAllowed: ["reviewer", "admin", "owner"] },
];

export async function getTokenIdentifier(ctx: QueryCtx | MutationCtx): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  return identity?.tokenIdentifier ?? "demo:anonymous";
}

export async function ensureBootstrapDefaults(ctx: MutationCtx) {
  const now = Date.now();

  let tenant = await ctx.db
    .query("tenants")
    .withIndex("by_key", (q) => q.eq("key", DEFAULT_TENANT_KEY))
    .unique();

  if (!tenant) {
    const tenantId = await ctx.db.insert("tenants", {
      key: DEFAULT_TENANT_KEY,
      name: "Default Tenant",
      region: "global",
      active: true,
      createdAt: now,
      updatedAt: now,
    });
    tenant = await ctx.db.get(tenantId);
  }
  if (!tenant) throw new Error("Failed to initialize tenant");

  const roleNames = ["owner", "admin", "editor", "reviewer", "viewer"] as const;
  for (const name of roleNames) {
    const existingRole = await ctx.db
      .query("roles")
      .withIndex("by_tenantId_and_name", (q) => q.eq("tenantId", tenant._id).eq("name", name))
      .unique();
    if (!existingRole) {
      await ctx.db.insert("roles", {
        tenantId: tenant._id,
        name,
        description: `${name} role`,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  const defaultTemplate = await ctx.db
    .query("workflowTemplates")
    .withIndex("by_tenantId_and_isDefault", (q) => q.eq("tenantId", tenant._id).eq("isDefault", true))
    .unique();
  if (!defaultTemplate) {
    await ctx.db.insert("workflowTemplates", {
      tenantId: tenant._id,
      name: "Default Editorial Workflow",
      isDefault: true,
      statuses: DEFAULT_WORKFLOW_STATUSES,
      transitions: DEFAULT_WORKFLOW_TRANSITIONS,
      createdAt: now,
      updatedAt: now,
    });
  }

  const tokenIdentifier = await getTokenIdentifier(ctx);
  let user = await ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", tokenIdentifier))
    .unique();

  if (!user) {
    const identity = await ctx.auth.getUserIdentity();
    const userId = await ctx.db.insert("users", {
      tokenIdentifier,
      email: identity?.email,
      name: identity?.name ?? "Demo User",
      createdAt: now,
      updatedAt: now,
    });
    user = await ctx.db.get(userId);
  }
  if (!user) throw new Error("Failed to initialize user");

  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_tenantId_and_userId", (q) => q.eq("tenantId", tenant._id).eq("userId", user._id))
    .unique();
  if (!membership) {
    const ownerRole = await ctx.db
      .query("roles")
      .withIndex("by_tenantId_and_name", (q) => q.eq("tenantId", tenant._id).eq("name", "owner"))
      .unique();
    if (!ownerRole) throw new Error("Owner role not found");
    await ctx.db.insert("memberships", {
      tenantId: tenant._id,
      userId: user._id,
      roleId: ownerRole._id,
      active: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  return { tenantId: tenant._id, userId: user._id };
}

export async function requireAccess(
  ctx: QueryCtx | MutationCtx,
  minimumRole: "viewer" | "editor" | "reviewer" | "admin" | "owner" = "viewer",
) {
  const tokenIdentifier = await getTokenIdentifier(ctx);
  const user = await ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", tokenIdentifier))
    .unique();
  if (!user) throw new Error("UNAUTHENTICATED");

  const tenant = await ctx.db
    .query("tenants")
    .withIndex("by_key", (q) => q.eq("key", DEFAULT_TENANT_KEY))
    .unique();
  if (!tenant || !tenant.active) throw new Error("FORBIDDEN");

  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_tenantId_and_userId", (q) => q.eq("tenantId", tenant._id).eq("userId", user._id))
    .unique();
  if (!membership || !membership.active) throw new Error("FORBIDDEN");

  const role = await ctx.db.get(membership.roleId);
  if (!role) throw new Error("FORBIDDEN");

  const hasPermission = (roleRank[role.name] ?? 0) >= (roleRank[minimumRole] ?? 0);
  if (!hasPermission) throw new Error("FORBIDDEN");

  return { tenant, user, membership, role };
}

export async function appendActivityLog(
  ctx: MutationCtx,
  input: {
    actorUserId: Id<"users">;
    action: string;
    entityType: string;
    entityId: string;
    documentId?: Id<"documents">;
    segmentId?: Id<"segments">;
    translationId?: Id<"translations">;
    commentId?: Id<"comments">;
    reason?: string;
    metadata?: {
      fromStatus?: string;
      toStatus?: string;
      locale?: string;
    };
  },
) {
  const tenant = await ctx.db
    .query("tenants")
    .withIndex("by_key", (q) => q.eq("key", DEFAULT_TENANT_KEY))
    .unique();
  if (!tenant) throw new Error("Tenant not found");

  await ctx.db.insert("activityLog", {
    tenantId: tenant._id,
    actorUserId: input.actorUserId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    documentId: input.documentId,
    segmentId: input.segmentId,
    translationId: input.translationId,
    commentId: input.commentId,
    reason: input.reason,
    metadata: input.metadata,
    createdAt: Date.now(),
  });
}

