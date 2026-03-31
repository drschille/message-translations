import { describe, expect, it } from "vitest";
import { appendActivityLog, requireAccess } from "../../../convex/_lib/platform";
import { createMockCtx } from "../../helpers/mockConvex";

function baseTables() {
  return {
    tenants: [
      {
        _id: "tenants:1",
        key: "default",
        name: "Default Tenant",
        active: true,
      },
    ],
    users: [
      {
        _id: "users:1",
        tokenIdentifier: "token:editor",
        name: "Editor User",
      },
    ],
    roles: [
      { _id: "roles:viewer", tenantId: "tenants:1", name: "viewer" },
      { _id: "roles:editor", tenantId: "tenants:1", name: "editor" },
    ],
    memberships: [
      {
        _id: "memberships:1",
        tenantId: "tenants:1",
        userId: "users:1",
        roleId: "roles:editor",
        active: true,
      },
    ],
    activityLog: [],
  };
}

describe("requireAccess", () => {
  it("throws UNAUTHENTICATED when user cannot be resolved", async () => {
    const { ctx } = createMockCtx({
      tables: { tenants: baseTables().tenants, users: [], roles: [], memberships: [] },
      identity: { tokenIdentifier: "missing" },
    });

    await expect(requireAccess(ctx, "viewer")).rejects.toThrow("UNAUTHENTICATED");
  });

  it("throws FORBIDDEN when membership is missing", async () => {
    const tables = baseTables();
    const { ctx } = createMockCtx({
      tables: { ...tables, memberships: [] },
      identity: { tokenIdentifier: "token:editor" },
    });

    await expect(requireAccess(ctx, "viewer")).rejects.toThrow("FORBIDDEN");
  });

  it("returns actor context when role is sufficient", async () => {
    const { ctx } = createMockCtx({
      tables: baseTables(),
      identity: { tokenIdentifier: "token:editor" },
    });

    const access = await requireAccess(ctx, "editor");
    expect(access.user._id).toBe("users:1");
    expect(access.role.name).toBe("editor");
    expect(access.tenant._id).toBe("tenants:1");
  });

  it("throws FORBIDDEN when role is insufficient", async () => {
    const tables = baseTables();
    tables.roles = [{ _id: "roles:viewer", tenantId: "tenants:1", name: "viewer" }];
    tables.memberships[0].roleId = "roles:viewer";

    const { ctx } = createMockCtx({
      tables,
      identity: { tokenIdentifier: "token:editor" },
    });

    await expect(requireAccess(ctx, "editor")).rejects.toThrow("FORBIDDEN");
  });
});

describe("appendActivityLog", () => {
  it("appends a row to activityLog with required metadata", async () => {
    const { ctx, tables } = createMockCtx({
      tables: baseTables(),
      identity: { tokenIdentifier: "token:editor" },
    });

    await appendActivityLog(ctx, {
      actorUserId: "users:1" as any,
      action: "translation.saved",
      entityType: "translation",
      entityId: "translations:1",
      documentId: "documents:1" as any,
      reason: "Save from test",
      metadata: { toStatus: "drafting", locale: "nb" },
    });

    expect(tables.activityLog.length).toBe(1);
    expect(tables.activityLog[0].action).toBe("translation.saved");
    expect(tables.activityLog[0].tenantId).toBe("tenants:1");
    expect(tables.activityLog[0].metadata.toStatus).toBe("drafting");
  });
});

