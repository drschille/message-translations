import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { ensureBootstrapDefaults, requireAccess } from "./_lib/platform";

export const bootstrapDefault = mutation({
  args: {
    tenantName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const result = await ensureBootstrapDefaults(ctx);
    if (args.tenantName) {
      const tenant = await ctx.db.get(result.tenantId);
      if (tenant && tenant.name !== args.tenantName) {
        await ctx.db.patch(result.tenantId, {
          name: args.tenantName,
          updatedAt: Date.now(),
        });
      }
    }
    return result;
  },
});

export const me = query({
  args: {},
  handler: async (ctx) => {
    const { tenant, user, role } = await requireAccess(ctx, "viewer");
    return {
      tenant: {
        id: tenant._id,
        key: tenant.key,
        name: tenant.name,
      },
      user: {
        id: user._id,
        tokenIdentifier: user.tokenIdentifier,
        email: user.email,
        name: user.name,
      },
      role: role.name,
    };
  },
});

export const listRoles = query({
  args: {},
  handler: async (ctx) => {
    const { tenant } = await requireAccess(ctx, "viewer");
    return await ctx.db
      .query("roles")
      .withIndex("by_tenantId_and_name", (q) => q.eq("tenantId", tenant._id))
      .collect();
  },
});

