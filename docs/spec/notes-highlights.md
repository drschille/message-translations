# Notes & Highlights Module Specification

## Purpose and Scope
Purpose:
- Provide personal annotation tools for sermon reading, including highlights, notes, bookmarks, and user-level organization.

In scope:
- Text range and paragraph highlights
- Note creation and editing
- Annotation dashboard views
- Annotation import/export for portability

Out of scope:
- Publishing translation content
- Editorial translation approvals
- Admin role governance

## Roles, Actors, and Permissions
- Authenticated Reader: creates and manages personal annotations.
- Admin: may enforce moderation/retention policies if configured.

Permission constraints:
- Annotation data is private to the owning user by default.
- Users can only mutate their own notes/highlights/bookmarks.
- Public readers without identity cannot create persistent annotations.

## Primary Workflows and Lifecycle States

### Highlight Workflow
1. User selects a text range or paragraph reference in reader.
2. User chooses highlight color/category.
3. System stores selection anchor and styling metadata.

### Notes Workflow
1. User attaches note to paragraph or selected range.
2. User can edit or delete note later.
3. Note remains anchored to published paragraph identity and version context.

### Dashboard Workflow
1. User opens annotation dashboard.
2. System lists notes/highlights grouped by sermon, date, and language.
3. User filters, searches, and navigates back to source sermon location.

### Import/Export Workflow
1. User exports all annotations as JSON.
2. User can import compatible JSON to restore annotations on another device/account context.
3. System validates ownership and schema before import commit.

## Data Ownership
Primary write ownership:
- `paragraphSelectionHighlights`
- `editorToolbarPrefs`
- Bookmark/note entities defined for this module (module-owned annotation tables)

Read dependencies:
- `sermonPublishedVersions`
- `sermonPublishedParagraphSnapshots`
- `sermons`

Ownership rules:
- Annotation entities are user-owned overlays on published sermon content.
- Annotation writes must not mutate published snapshot data.

## Interface Expectations (Behavior-Level)
- `createHighlight(userId, sermonId, language, version, selection, style)`: writes highlight entry.
- `updateHighlight(userId, highlightId, patch)`: updates style or anchor metadata.
- `deleteHighlight(userId, highlightId)`: removes highlight owned by user.
- `createNote(userId, anchor, body)`: creates note on paragraph/range anchor.
- `updateNote(userId, noteId, body)`: edits note content.
- `deleteNote(userId, noteId)`: removes note.
- `listUserAnnotations(userId, filters)`: returns grouped notes/highlights/bookmarks.
- `exportUserAnnotations(userId)`: returns JSON payload.
- `importUserAnnotations(userId, payload)`: validates and upserts compatible records.

Constraints:
- Anchors must reference valid published paragraph identity and version context.
- Import payload must be schema-valid and deduplicated by deterministic key rules.
- Ownership checks are mandatory on every mutation.

## Failure Cases and Non-Goals
Failure cases:
- Import of malformed JSON must fail with per-record validation details.
- Missing anchor targets should be flagged and skipped or rejected per import mode.
- Concurrent edits to same note should resolve safely without cross-user leakage.

Non-goals:
- Shared/team annotations in this version.
- Cross-user comments on annotations.
- Global annotation search across all users for public display.

## Acceptance Criteria
- Authenticated users can create/edit/delete highlights, notes, and bookmarks.
- Dashboard correctly groups and filters user annotations.
- Export generates portable JSON including anchors and metadata.
- Import restores valid annotations without mutating canonical or published content.
- Annotation data remains private and permission-guarded by ownership.
