# GAP Analysis: Message Translations Platform

## Context

The project has a complete set of module specifications (6 modules + core) and strong implementation for Translation/Editorial plus partial Reader support. It is missing implementation for three major modules (Administration, Publishing/Export, Search) and has partial gaps in Reader/Playback and Notes & Highlights.

The goal is a complete, spec-driven platform for preserving, translating, publishing, and consuming sermon content.

---

## GAP List with Tasks

### GAP 1 — Publishing / Export (10% implemented)

Schema exists (`sermonPublishedVersions`, `sermonPublishedParagraphSnapshots`), but no logic.

**Task 1.1 — Backend: Validate Publishing Readiness**
- Implement `validatePublishReadiness(sermonId, language)` in `convex/publishing.ts`
- Check that all paragraph translations for (sermonId, language) are in `approved` status
- Return a list of non-approved paragraphs on failure

**Task 1.2 — Backend: Publish Action**
- Implement `publishSermonVersion(sermonId, language, requestedBy)` in `convex/publishing.ts`
- Call `validatePublishReadiness` first (throw error if not ready)
- Create a new version (increment) in `sermonPublishedVersions`
- Materialize snapshot rows in `sermonPublishedParagraphSnapshots`
- Log publish event with actor + timestamp
- Existing versions are immutable (append-only)

**Task 1.3 — Backend: Read Published Versions**
- `listPublishedVersions(sermonId, language)` → all versions for a sermon+language
- `getPublishedSermon(sermonId, language, version?)` → snapshot (latest version if omitted)

**Task 1.4 — Backend: Export**
- `exportPublishedSermon(sermonId, language, version, format: 'json'|'csv')` in `convex/publishing.ts`
- Read exclusively from snapshot tables
- Generate JSON or CSV artifact with metadata
- Log export event

**Task 1.5 — Frontend: Publish Controls in EditorSermonsPage**
- Button “Publish Translation” for approved sermons
- Validation message when approved paragraphs are missing
- Show publishing history (version list)

**Task 1.6 — Frontend: Export Download**
- Download button for published versions (JSON/CSV)
- Shown on both `EditorSermonsPage` and `ReaderPage`

**Task 1.7 — Tests: Publishing Module**
- Unit tests for publish validation (missing approvals → error)
- Unit tests for snapshot materialization
- Unit tests for immutability (new version on republish)

---

### GAP 2 — Administration (5% implemented)

No user/role/task system exists.

**Task 2.1 — Backend: User and Role Management**
- New file `convex/administration.ts`
- `createUser(profile)`, `deleteUser(userId)`, `assignRoles(userId, roles[])`
- Use `tokenIdentifier` as user ID (consistent with existing patterns)
- Capability matrix: roles → allowed actions

**Task 2.2 — Backend: Sermon Workflow Orchestration**
- `markSermonWorkflowState(sermonId, state: 'ready'|'in_progress'|'completed')`
- Add `workflowState` field to `sermons` table (schema migration)
- Validate transitions (only authorized transitions allowed)

**Task 2.3 — Backend: Task Assignment**
- `assignTask(taskType, target, assignee)`, `reassignTask(taskId, assignee)`
- `getWorkQueue(userId)` → list of tasks for user
- Create `tasks` table in schema (type, target, assignee, status, createdAt)

**Task 2.4 — Frontend: Admin Panel**
- New route `/admin` with `AdminPage.tsx`
- User listing + role assignment
- Sermon workflow overview (ready/in progress/completed)
- Task distribution per user

**Task 2.5 — Frontend: Work Queue UI**
- New route `/editor/queue` with `WorkQueuePage.tsx`
- Show assigned tasks for logged-in user
- Direct links to sermons/paragraphs

---

### GAP 3 — Search (5% implemented)

Null implementation. Schema (`searchIndexJobs`, `searchQueryLogs`, `searchEmbeddingVectors`) exists.

**Task 3.1 — Backend: Full-Text Search**
- `searchFullText(query, filters, scope)` in new `convex/search.ts`
- Use Convex built-in full-text search index (`searchIndex` in schema)
- Support phrase search and boolean operators
- Return hits with snippets/fragments

**Task 3.2 — Backend: AI Semantic Search**
- `searchAI(query, filters, scope)`
- Integrate Google GenAI (already installed: `@google/genai`) for embeddings
- Generate embedding for search query → cosine similarity against `searchEmbeddingVectors`
- Return top-k results with score

**Task 3.3 — Backend: Bible Verse Search**
- `searchByBibleVerse(reference, filters, scope)`
- Normalize references (e.g. “John 3:16” → standard format)
- Match explicit and related contexts

**Task 3.4 — Backend: Indexing Pipeline**
- `reindexSermon(sermonId, language?, scope)` and `reindexAll(scope)`
- Index job orchestration via `searchIndexJobs` (queued → running → succeeded/failed)
- Trigger on content changes in editorial workflow

**Task 3.5 — Frontend: Search Page**
- New route `/search` with `SearchPage.tsx`
- Search field + result view with snippets
- Tabs: full-text / AI / bible verse
- Filtering options (language, series, year)

**Task 3.6 — Frontend: Search in Existing Pages**
- Integrate search in `TranslationsPage.tsx` (already has a search-string prop)
- Search bar in navigation (`Navbar.tsx`)

---

### GAP 4 — Reader / Playback (60% implemented)

UI for audio exists but is not functional.

**Task 4.1 — Backend: Reader API**
- `getPublishedReaderView(sermonId, language, version?)` in `convex/reader.ts`
- Combine metadata + paragraphs from published snapshot tables
- `listPublishedLanguages(sermonId)` → available languages

**Task 4.2 — Backend: Audio Track Integration**
- `getPlaybackTrack(sermonId, language, version?, source)`
- Return `audioUrl` from `sermons` table
- Prepare structure for TTS fallback (ElevenLabs-ready, but no forced implementation)

**Task 4.3 — Backend: Scripture Reference Resolution**
- `resolveScriptureReferences(sermonId, language, version?)`
- Extract and normalize scripture references from paragraph text
- Return annotated references with links

**Task 4.4 — Frontend: Functional Audio Playback**
- Connect audio buttons to an actual HTML5 `<audio>` element in `ReaderPage.tsx`
- Implement play/pause/seek controls
- Highlight active paragraph during playback (based on timestamps if available)

**Task 4.5 — Frontend: ReaderPage from Published Snapshots**
- Update `ReaderPage.tsx` to read from published snapshot tables (not raw translations)
- Version selector UI (default = latest version)

---

### GAP 5 — Notes & Highlights (70% implemented)

IndexedDB works, but server-side persistence and dashboard are missing.

**Task 5.1 — Backend: Server-Side Annotation Persistence**
- Create `userHighlights` and `userNotes` tables in schema (if not already modeled)
- `createHighlight(userId, sermonId, language, version, selection, style)` in `convex/annotations.ts`
- `updateHighlight`, `deleteHighlight`, `createNote`, `updateNote`, `deleteNote`
- Ownership checks mandatory on all mutations

**Task 5.2 — Backend: Annotation Listing and Export**
- `listUserAnnotations(userId, filters)` with filtering by sermon/date/language
- `exportUserAnnotations(userId)` → JSON export
- `importUserAnnotations(userId, payload)` with schema validation and deduplication

**Task 5.3 — Frontend: Annotation Dashboard**
- New route `/annotations` with `AnnotationsDashboard.tsx`
- Grouped by sermon/date/language
- Filter/search within user’s own notes and highlights

**Task 5.4 — Migration: IndexedDB → Server-Side**
- Migration helper that exports IndexedDB data and imports to server via `importUserAnnotations`
- Show one-time migration message to logged-in users

---

### GAP 6 — Cross-Module Infrastructure (missing)

**Task 6.1 — Authentication and Authorization**
- Integrate Convex Auth (or existing token system)
- Capability matrix enforced in backend functions
- Distinguish unauthorized and authorized users consistently

**Task 6.2 — Audit Log**
- Consistent actor+timestamp logging on all mutations (editorial has this partially)
- Centralize logic layer in a Convex helper (e.g. `withAudit(ctx, fn)`)

**Task 6.3 — Error Handling and Standardization**
- Standardize error message format across Convex functions
- Frontend: consistent toast messages / error display

---

## GAP 7 — Design / UX (design/mt.pen)

### What IS Designed (12 frames in mt.pen)

| Frame | Covers |
|-------|--------|
| Landing Page | Hero, sermon list, about us, footer |
| Sermons Page | Search, filter, paginated list |
| Sermon Reader | Reading mode, color markers, toolbar |
| Sermon Reader — Panel Open | Reader with notes/highlights panel open |
| Comparison Reader | Split view English/Norwegian side by side |
| Sermon Reader — Proofreading | Proofreading with avatar indicators per paragraph |
| Version History Overlay | Version list with compare/restore |
| Comments Overlay | Threaded comment modal |
| Notes Panel (Expanded) | Side panel with highlights and notes |
| Design System (R9tUP + JeK3D) | Typography, colors, components, layout patterns |

---

### Design GAP 7.1 — Search Page (not designed)

No design for search exists. Spec requires full-text, AI, and bible verse search.

**Task 7.1.1 — Design: Search Page**
- Page with search field, tab navigation (Full-text / AI / Bible verse)
- Result cards with snippet, sermon title, language, version badge
- Filter panel (year, series, language)
- State design: empty search, no results, loading

**Task 7.1.2 — Design: Search in Navbar**
- Expandable search bar in navigation (icon → input)
- Quick results / typeahead dropdown

---

### Design GAP 7.2 — Administration Panel (not designed)

No design for user/role/task management.

**Task 7.2.1 — Design: Admin Overview**
- User list with role badges (Translator / Proofreader / Editor / Publisher)
- Role assignment modal (inline or slide-over)
- Sermon workflow status table (ready / in progress / completed)

**Task 7.2.2 — Design: Work Queue**
- Task list per user (assigned paragraphs/sermons)
- Direct link to editorial view
- Priority and due dates

---

### Design GAP 7.3 — Publishing and Export (not designed)

Publishing and export flow is entirely missing.

**Task 7.3.1 — Design: Publish Button and Confirmation Steps**
- Publish button on `EditorSermonsPage` (inactive if not ready)
- Validation modal: shows number of non-approved paragraphs
- Confirmation dialog with version number and author

**Task 7.3.2 — Design: Version Overview**
- List of published versions per sermon+language
- Timeline with version number, date, publisher

**Task 7.3.3 — Design: Export Dialog**
- Format selector (JSON / CSV)
- Version selector
- Download button

---

### Design GAP 7.4 — Authentication (not designed)

No login/signup pages are designed.

**Task 7.4.1 — Design: Login Page**
- Minimal login form (email + password or SSO)
- Consistent with design system (dark theme, typography)

---

### Design GAP 7.5 — Annotation Dashboard (not designed)

Notes Panel is designed as a reader side panel, but no standalone dashboard page.

**Task 7.5.1 — Design: Annotation Dashboard**
- Full-page view of all user notes and highlights
- Grouped by sermon / date / language
- Search/filter in user annotations
- Export/import buttons

---

### Design GAP 7.6 — Audio Playback (not functionally designed)

The reader shows color markers and buttons, but no dedicated audio player UI.

**Task 7.6.1 — Design: Audio Player Component**
- Persistent player bar (bottom or top of screen)
- Play/pause, skip forward/backward, timeline with progress
- Active paragraph highlight synchronized with playback

---

### Design GAP 7.7 — Mobile Design (not designed)

All 12 frames are 1440px desktop. No mobile breakpoints exist.

**Task 7.7.1 — Design: Mobile Reader Version (390px)**
- Single-column layout for reader
- Collapsible toolbar
- Notes panel as bottom sheet

**Task 7.7.2 — Design: Mobile Sermons Page Version**
- Stacked sermon cards
- Filters as bottom sheet

---

### Design GAP 7.8 — System States (not designed)

No empty states, error pages, or loading indicators are formally designed.

**Task 7.8.1 — Design: Empty States**
- No sermons found (search with no hits)
- No notes yet
- No published versions

**Task 7.8.2 — Design: Error and Loading**
- 404 page
- General error page
- Skeleton loaders (already used in code, should be standardized)

---

### Design GAP 7.9 — Scripture Reference View (not designed)

Spec mentions scripture references in the reader, but no design exists for this.

**Task 7.9.1 — Design: Scripture Reference Tooltip/Panel**
- Inline tooltip on hover over bible references
- Or expandable panel in the side margin

---

### Summary: Design Coverage per Module

| Module | Design status |
|-------|--------------|
| Reader / Playback | 70% — missing audio player, mobile, scripture reference |
| Translation / Editorial | 85% — proofreading, comments, versioning designed |
| Notes & Highlights | 60% — panel designed, dashboard missing |
| Publishing / Export | 0% — nothing designed |
| Administration | 0% — nothing designed |
| Search | 0% — nothing designed |
| Authentication | 0% — no login pages |
| System states | 10% — only implicit via shimmer components |

---

## Implementation Order (recommended)

```
1. GAP 7 (Design) — Publishing, Admin, Search, Auth  [design-first]
2. GAP 1 — Publishing/Export backend               (blocks Reader from published content)
3. GAP 4 — Reader completion                       (depends on published snapshots + audio design)
4. GAP 5 — Notes & Highlights server-side          (depends on published versions as anchors)
5. GAP 2 — Administration                          (independent, but important for workflow control)
6. GAP 3 — Search                                  (depends on indexed published content)
7. GAP 6 — Infrastructure                          (can be parallelized, but best early)
8. GAP 7 (Design) — Mobile, system states          [after core functionality]
```

## Critical Files for Modification

- [convex/schema.ts](../convex/schema.ts) — Add `tasks`, possibly `workflowState` on sermons
- [convex/editorial.ts](../convex/editorial.ts) — Hook indexing on status changes
- [src/App.tsx](../src/App.tsx) — New routes: `/admin`, `/editor/queue`, `/search`, `/annotations`
- [src/components/ReaderPage.tsx](../src/components/ReaderPage.tsx) — Published snapshots + audio
- New files: `convex/publishing.ts`, `convex/administration.ts`, `convex/search.ts`, `convex/reader.ts`, `convex/annotations.ts`

## Verification

- Publishing: Create sermon with all approved paragraphs → call publish → verify snapshot rows
- Export: Download JSON/CSV → verify structure matches spec
- Search: Index a sermon → search for phrase → verify hit with snippet
- Reader: Navigate to published sermon → verify only snapshot data is shown (not raw)
- Admin: Assign role → verify capability matrix is enforced in backend
