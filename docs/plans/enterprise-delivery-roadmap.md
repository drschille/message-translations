# Enterprise Delivery Roadmap

## Goal
Deliver a reusable enterprise editorial backend with predictable tailoring delivery for customer-specific frontends.

## Phase 1: Platform Foundation
### Deliverables
- Tenant model and bootstrap flow.
- Identity baseline (email/password) with optional SSO extension path.
- RBAC primitives and policy guard utilities.
- Initial generic schema and typed API scaffolding.

### Exit Criteria
- Tenant-isolated deployments are operational.
- Public APIs enforce identity, membership, and role checks.
- Baseline schema supports generic documents and users.

## Phase 2: Editorial Core
### Deliverables
- Document import and segment splitting pipeline.
- Locale setup and active translation model.
- Version chain with rollback support.
- Comment threads and resolution workflows.
- Config-driven workflow state transitions.

### Exit Criteria
- Every translation save creates version + actor/timestamp metadata.
- Rollback creates a new version event.
- Workflow rules are configurable per tenant without code forks.

## Phase 3: Audit and Operability
### Deliverables
- Immutable activity log for all critical actions.
- Operational dashboards/events for support teams.
- Tenant admin controls for roles, workflow templates, and settings.
- Data residency onboarding and operational runbook.

### Exit Criteria
- Full audit timeline is queryable by tenant/document/actor.
- Critical operations are traceable end-to-end.
- Region/residency handling is documented and operationally repeatable.

## Phase 4: Frontend Adaptation Pattern
### Deliverables
- Reference mapping guide from domain UI to generic backend APIs.
- Branham-specific frontend mapping (sermons terminology over generic backend objects).
- Reusable frontend adapter patterns for future customer projects.

### Exit Criteria
- Branham frontend works without backend schema fork.
- New use-case frontend can be implemented by mapping, not backend redesign.

## Commercial Delivery Model
- Platform team owns core backend modules and upgrade path.
- Services team owns customer-specific workflow config and frontend tailoring.
- Custom requests are triaged as:
- platform enhancement (reusable)
- tenant configuration
- customer-specific delivery project

## Governance
- No per-customer backend forks by default.
- Changes to core contracts require backward compatibility review.
- Every phase must include security and audit validation before close.

