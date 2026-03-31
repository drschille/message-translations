import { describe, expect, it } from "vitest";
import { computeDocumentStatus, isAllowedTransition } from "../../convex/_lib/workflowUtils";

describe("computeDocumentStatus", () => {
  it("returns draft for empty input", () => {
    expect(computeDocumentStatus([])).toBe("draft");
  });

  it("returns approved when all segments are approved", () => {
    expect(computeDocumentStatus(["approved", "approved"])).toBe("approved");
  });

  it("prioritizes blocked over needs_review and drafting", () => {
    expect(computeDocumentStatus(["drafting", "needs_review", "blocked"])).toBe("blocked");
  });

  it("returns needs_review when at least one segment needs review and none blocked", () => {
    expect(computeDocumentStatus(["approved", "needs_review"])).toBe("needs_review");
  });

  it("returns drafting when there are no blocked or needs_review statuses", () => {
    expect(computeDocumentStatus(["drafting", "approved"])).toBe("drafting");
  });
});

describe("isAllowedTransition", () => {
  const transitions = [
    { from: "drafting", to: "needs_review", rolesAllowed: ["editor", "reviewer"] },
    { from: "needs_review", to: "approved", rolesAllowed: ["reviewer"] },
  ];

  it("allows configured role transitions", () => {
    expect(isAllowedTransition(transitions, "drafting", "needs_review", "editor")).toBe(true);
  });

  it("rejects non-configured transitions", () => {
    expect(isAllowedTransition(transitions, "draft", "approved", "reviewer")).toBe(false);
  });

  it("allows owner/admin even if role list does not include them explicitly", () => {
    expect(isAllowedTransition(transitions, "needs_review", "approved", "owner")).toBe(true);
    expect(isAllowedTransition(transitions, "needs_review", "approved", "admin")).toBe(true);
  });
});

