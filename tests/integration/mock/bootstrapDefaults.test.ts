import { describe, expect, it } from "vitest";
import { ensureBootstrapDefaults } from "../../../convex/_lib/platform";
import { createMockCtx } from "../../helpers/mockConvex";

describe("ensureBootstrapDefaults", () => {
  it("creates tenant, roles, user, membership, and default workflow template", async () => {
    const { ctx, tables } = createMockCtx({
      tables: {},
      identity: {
        tokenIdentifier: "token:test-owner",
        email: "owner@example.com",
        name: "Owner",
      },
    });

    const result = await ensureBootstrapDefaults(ctx);

    expect(result.tenantId).toBeTruthy();
    expect(result.userId).toBeTruthy();
    expect(tables.tenants.length).toBe(1);
    expect(tables.roles.length).toBe(5);
    expect(tables.users.length).toBe(1);
    expect(tables.memberships.length).toBe(1);
    expect(tables.workflowTemplates.length).toBe(1);
    expect(tables.workflowTemplates[0].isDefault).toBe(true);
  });

  it("is idempotent on repeated calls", async () => {
    const { ctx, tables } = createMockCtx({
      tables: {},
      identity: {
        tokenIdentifier: "token:test-owner",
      },
    });

    await ensureBootstrapDefaults(ctx);
    await ensureBootstrapDefaults(ctx);

    expect(tables.tenants.length).toBe(1);
    expect(tables.roles.length).toBe(5);
    expect(tables.users.length).toBe(1);
    expect(tables.memberships.length).toBe(1);
    expect(tables.workflowTemplates.length).toBe(1);
  });
});

