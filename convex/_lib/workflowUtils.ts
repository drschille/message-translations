export type WorkflowStatus = "draft" | "drafting" | "needs_review" | "approved" | "blocked";

export function computeDocumentStatus(statuses: string[]): WorkflowStatus {
  if (statuses.length === 0) return "draft";
  if (statuses.every((s) => s === "approved")) return "approved";
  if (statuses.some((s) => s === "blocked")) return "blocked";
  if (statuses.some((s) => s === "needs_review")) return "needs_review";
  if (statuses.some((s) => s === "drafting")) return "drafting";
  return "draft";
}

export function isAllowedTransition(
  transitions: Array<{ from: string; to: string; rolesAllowed: string[] }>,
  from: string,
  to: string,
  roleName: string,
): boolean {
  return transitions.some((transition) => {
    if (transition.from !== from || transition.to !== to) return false;
    if (roleName === "owner" || roleName === "admin") return true;
    return transition.rolesAllowed.includes(roleName);
  });
}

