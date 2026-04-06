# Publishing / Export Module Specification

## Purpose and Scope
Purpose:
- Publish approved translations as immutable, reproducible versions and expose exportable outputs.

In scope:
- Publish eligibility checks
- Version creation and immutable snapshot generation
- Export production in supported formats
- Optional integration boundaries for external consumers

Out of scope:
- Paragraph translation editing (Translation / Editorial)
- User/role governance (Administration)
- Reader rendering behavior (Reader / Playback)

## Roles, Actors, and Permissions
- Publisher: executes publish actions and export jobs.
- Reviewer: prepares content to publication-ready state.
- Admin: manages publish permissions and policy overrides.

Permission constraints:
- Only users with publish capability can create published versions.
- Publish requires content readiness validation.
- Once published, snapshots cannot be edited in place.

## Primary Workflows and Lifecycle States

### Publish Workflow
1. Publisher requests publication for `(sermonId, language)`.
2. System validates all required paragraphs are `approved`.
3. System creates next version number and immutable published version record.
4. System materializes paragraph snapshot rows for that version.
5. Publish event is logged with actor and timestamp.

### Versioning Rules
- Published versions are append-only.
- Republish creates a new version; it never mutates an existing published version.
- Consumers must reference explicit version or default latest published version.

### Export Workflow
1. Publisher selects sermon, language, version, and format.
2. System reads from published snapshot tables only.
3. System emits export artifact (`JSON`, `CSV`).
4. System records export metadata for traceability.

## Data Ownership
Primary write ownership:
- `sermonPublishedVersions`
- `sermonPublishedParagraphSnapshots`

Read dependencies:
- `sermons`
- `sermonParagraphs`
- `sermonParagraphTranslations`
- `sermonMetadataTranslations`

Ownership rules:
- Publishing writes immutable snapshots derived from approved editorial state.
- Export reads only from published data for consistency and reproducibility.

## Interface Expectations (Behavior-Level)
- `validatePublishReadiness(sermonId, language)`: returns readiness status and blocking reasons.
- `publishSermonVersion(sermonId, language, requestedBy)`: creates immutable version and snapshots.
- `listPublishedVersions(sermonId, language)`: returns ordered version metadata.
- `getPublishedSermon(sermonId, language, version?)`: returns published payload for consumers.
- `exportPublishedSermon(sermonId, language, version, format)`: returns artifact metadata and file handle/location.

Constraints:
- Publish request fails if any required paragraph is not `approved`.
- Snapshot records must include metadata required for deterministic reconstruction.
- Export format must be one of currently supported values (`json`, `csv`).

## Failure Cases and Non-Goals
Failure cases:
- Partial snapshot writes must roll back transactionally.
- Export jobs should fail fast on missing published version references.
- Duplicate publish requests for same sermon/language at same instant must be serialized safely.

Non-goals:
- Editing published snapshots.
- Arbitrary export templating in this version.
- Direct public write access to published tables.

## Acceptance Criteria
- Only fully approved sermon translations can be published.
- Every publish operation creates a new immutable version and snapshot set.
- Published content remains stable even if editorial drafts change later.
- JSON and CSV exports match the selected published version exactly.
- Publish and export actions are auditable by actor and timestamp.
