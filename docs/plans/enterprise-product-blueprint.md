# Enterprise Product Blueprint

## Purpose
Define the enterprise version as a reusable backend platform for editorial workflows, while allowing domain-specific frontends (for example Branham sermons) to adapt the user experience without changing core backend design.

## Product Vision
- Build a generic editorial workflow backend on Convex.
- Keep frontend implementations use-case specific.
- Monetize through professional services that tailor workflows, permissions, and UX to each customer.

## Strategic Decisions (Locked)
- Tenancy model: per-tenant Convex deployment.
- Workflow customization model: config-driven workflow templates.
- Commercial focus: professional-services-heavy delivery.
- Identity baseline: email/password with optional SSO per customer.
- Compliance target: strong audit trail with data residency readiness.

## Platform Boundaries
### Productized Platform Core
- Tenant lifecycle and deployment bootstrap.
- Identity and user management primitives.
- RBAC and policy enforcement.
- Generic document + segment + translation + versioning engine.
- Comment and collaboration primitives.
- Workflow engine driven by tenant configuration.
- Immutable activity and audit logging.

### Domain-Specific Layer (Frontend + Mapping)
- Vocabulary and UI semantics (e.g. sermon labels, archive navigation).
- Domain-specific views, filters, and page structure.
- Optional frontend-only behavior that does not alter backend contracts.

## Platform vs Services
### Platform Standard (included)
- Stable generic schema and APIs.
- Configuration-based workflow behavior.
- Security and audit primitives.
- Upgrade-safe extension points.

### Billable Tailoring (services)
- Customer-specific workflow templates and transitions.
- Role mapping and approval policies.
- Domain-specific frontend implementation.
- Integrations and custom reporting views.

### Explicit Non-Goals
- Per-customer backend forks as the default strategy.
- Domain logic hardcoded into platform core.

## Success Metrics
- One backend core reused across multiple customers/use cases.
- Customer onboarding mostly via configuration and mapping.
- Full traceability of high-impact editorial events.
- Ability to deliver domain-specific UI without schema forks.

