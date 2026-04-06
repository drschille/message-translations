# Enterprise Backend Specification

## Scope
Specification for the generic Convex backend used by multiple editorial products and frontends.

## Core Domain Model (Generic)
- `tenants`: tenant identity, deployment metadata, operational settings.
- `users`: platform user profile and identity references.
- `memberships`: user-to-tenant relationship.
- `roles`: tenant role definitions.
- `documents`: document container and global status.
- `documentLocales`: enabled target locales per document.
- `segments`: stable source-paragraph/segment identity and ordering.
- `translations`: current active translation per segment and locale.
- `translationVersions`: immutable version chain for each translation change.
- `comments`: comment entities with thread and status metadata.
- `workflowTemplates`: tenant-configured status models and transition rules.
- `workflowStates`: current state projections at segment/document level.
- `activityLog`: immutable audit events for critical actions.

## Authorization and Policy
- Every public Convex function must:
- Validate all args.
- Resolve actor identity server-side.
- Verify tenant membership.
- Enforce role/resource policy before data access or mutation.
- No authorization via client-supplied user identifiers.
- Policy matrix must cover read, edit, submit, approve, rollback, comment, resolve, admin operations.

## Workflow Configuration Contract
- Config defines:
- Status definitions (segment and document level).
- Allowed transitions.
- Approval requirements.
- Comment resolution gates.
- Completion criteria.
- Workflow behavior must be data/config-driven, not domain-hardcoded.

## API Surface (Module-Oriented)
- `documents.*`: create/import/list/get/update document metadata and lifecycle.
- `workflow.*`: transition states, compute progress, enforce approval gates.
- `translations.*`: upsert active translation, create new version entries, rollback.
- `comments.*`: create thread/reply, resolve/reopen, list by filters.
- `history.*`: version history, diff payloads, event timelines.
- `admin.*`: tenant settings, role mappings, template management.

## Validation and Error Contract
- All public functions include explicit Convex validators.
- Standardized error taxonomy:
- `UNAUTHENTICATED`
- `FORBIDDEN`
- `NOT_FOUND`
- `INVALID_ARGUMENT`
- `CONFLICT`
- `RATE_LIMITED`
- `INTERNAL`

## Audit and Compliance Baseline
- `activityLog` is append-only and immutable.
- Audited events include:
- document create/import/delete/archive
- translation edits and submits
- status transitions and approvals
- comment create/resolve/reopen
- version rollback
- role/membership/admin changes
- Include actor, tenant, target resource, timestamp, and reason metadata.

## Data Residency Readiness
- Per-tenant deployment supports region-aware customer placement.
- Region and residency requirements captured in tenant operational metadata and onboarding runbooks.

## Frontend Adaptation Contract
- Frontends map domain concepts to generic backend constructs.
- Domain labels and page flows remain frontend concerns.
- Backend APIs and schema remain stable across verticals.

