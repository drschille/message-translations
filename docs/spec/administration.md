# Administration Module Specification

## Purpose and Scope
Purpose:
- Govern users, permissions, assignment policies, and workflow orchestration across modules.

In scope:
- User lifecycle administration
- Role and capability assignment
- Workflow orchestration for sermon translation lifecycle
- Task assignment at user and group levels

Out of scope:
- Editing translation text (Translation / Editorial)
- Snapshot publishing and export (Publishing / Export)
- Public reading and playback (Reader / Playback)

## Roles, Actors, and Permissions
- Admin: full access to user management, role mapping, and orchestration controls.
- Publisher: can be assigned publish capability by admin policy.
- Translator/Proofreader/Reviewer: role groups administered by this module.

Permission constraints:
- Only admins can create/delete users and assign privileged roles.
- Role capability matrix is centrally managed and versioned.
- Assignment actions must record who assigned what and when.

## Primary Workflows and Lifecycle States

### User and Role Workflow
1. Admin creates user.
2. Admin assigns one or more roles.
3. System enforces capability matrix at action time.
4. Admin deactivates or removes user when required.

### Sermon Workflow Orchestration
Sermon workflow states:
- `ready`
- `in_progress`
- `completed`

Transitions:
- `ready -> in_progress` when work is assigned or work starts.
- `in_progress -> completed` when editorial completion criteria are met.
- `completed -> in_progress` when reopening is authorized.

### Task Assignment Workflow
1. Admin (or delegated coordinator) generates tasks at sermon or paragraph granularity.
2. Tasks are assigned to individual users or role groups.
3. Reassignment preserves assignment history.
4. Progress boards show pending, in-progress, and completed tasks.

## Data Ownership
Primary write ownership:
- User, role, capability, and assignment entities (module-owned admin tables)
- Orchestration state for sermon work lifecycle

Read dependencies:
- `sermons`
- `sermonParagraphs`
- `sermonParagraphTranslations` (status for orchestration checks)

Ownership rules:
- Administration controls permissions and orchestration metadata.
- Content tables remain owned by their originating modules.

## Interface Expectations (Behavior-Level)
- `createUser(profile)`: creates user account with baseline status.
- `deleteUser(userId)`: deactivates/removes user per policy and reassigns open tasks.
- `assignRoles(userId, roles[])`: updates role mapping with audit entry.
- `setRoleCapabilities(role, capabilities[])`: updates role permission matrix.
- `markSermonWorkflowState(sermonId, state)`: transitions sermon lifecycle state with validation.
- `assignTask(taskType, target, assignee)`: assigns translation/review/publish/admin tasks.
- `reassignTask(taskId, assignee)`: transfers ownership while retaining history.
- `getWorkQueue(userId)`: returns prioritized pending tasks.

Constraints:
- Privileged role assignment requires admin permission.
- Lifecycle transitions must validate prerequisite conditions.
- Reassignment cannot erase historical ownership metadata.

## Failure Cases and Non-Goals
Failure cases:
- Assigning tasks to inactive users must fail with actionable error.
- Circular or conflicting role capability definitions must be rejected.
- Unauthorized role escalation attempts must be denied and logged.

Non-goals:
- Building a generic enterprise IAM platform.
- Replacing module-specific content validations.
- Auto-resolution of editorial disagreements.

## Acceptance Criteria
- Admins can manage users and role assignments end to end.
- Capability checks are enforced consistently across protected actions.
- Sermon orchestration states reflect workflow progression accurately.
- Task assignment and reassignment preserve full audit trail.
- Non-admin users cannot self-elevate or bypass permission checks.
