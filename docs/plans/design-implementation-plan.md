# Design Implementation Plan

## Goal

Close all design gaps in `design/mt.pen` so that every feature in the gap-analysis has a corresponding, buildable frame before implementation begins. Follows the overall gap priority order from the GAP analysis.

## Existing Frames (reference)

| ID | Frame | Status |
|----|-------|--------|
| `a6gET` | Landing Page | Complete |
| `fuAhh` | Sermons Page | Complete |
| `4B61M` | Sermon Reader | Complete |
| `msk78` | Sermon Reader — Panel Open | Complete |
| `MIT1r` | Comparison Reader | Complete |
| `g6m3v` | Sermon Reader — Proofreading (Current) | Complete |
| `GKEEN` | Sermon Reader — Proofreading (Panel) | Complete |
| `uEfmu` | Version History Overlay | Complete |
| `sxz6f` | Comments Overlay | Complete |
| `3l38E` | Notes Panel (Expanded) | Complete |
| `R9tUP` | Design System Template | Complete |
| `JeK3D` | Design System (Full) | Complete |

---

## Phase 1 — Publishing, Admin, Search, Auth (design-first, blocks implementation)

These four areas have zero design coverage but are required before any corresponding backend work begins.

### 1.1 — Publishing: Publish Button and Confirmation

**New frame: `Publishing — Sermon List with Publish Action`**

Extend the existing Sermons Page pattern (`fuAhh`) to show editorial state:
- Sermon row: add "Publish" CTA button, disabled state when not all paragraphs approved
- Disabled state: tooltip "X paragraphs still need approval"
- Active state: primary button "Publish translation"

**New overlay: `Publishing — Publish Confirmation Modal`**

Modal triggered by Publish CTA:
- Header: "Publish translation" + sermon title
- Body: version number (auto-incremented, e.g. "This will create version 3"), language badge, publisher name (from auth context)
- Warning section if any paragraph is not approved: list up to 5 non-approved paragraphs with status chips
- Actions: "Cancel" (secondary), "Confirm publish" (primary, disabled if not ready)

**New overlay: `Publishing — Version History Panel`**

Shown inline below sermon row or as a slide-over:
- Timeline list: version number, date, publisher name, language
- Each row: "View snapshot" link
- Most recent version marked "Current"

### 1.2 — Publishing: Export Dialog

**New overlay: `Publishing — Export Dialog`**

- Header: "Export sermon"
- Sermon title + language badge
- Version selector: dropdown (default = latest), list of available versions with dates
- Format selector: segmented control "JSON / CSV"
- Preview: short description of what the format contains
- Actions: "Cancel", "Download"

### 1.3 — Administration: Admin Panel

**New frame: `Admin — User Management`** (1440px, dark theme, matches existing nav)

Layout:
- Left sidebar: nav items (Users, Sermon Workflow, Work Queues)
- Main content: Users tab active by default

Users tab:
- Table: Name, Email, Roles (badge group), Last active, Actions (Edit roles, Delete)
- Role badges using existing StatusChip components adapted: Translator, Proofreader, Reviewer, Publisher, Admin
- "Add user" button (primary) top-right
- Role assignment modal: user name header, checkbox group for roles, Save/Cancel actions

Sermon Workflow tab:
- Table: Sermon title, Date, Series, Language, Workflow state (ready/in progress/completed), Assigned to, Actions
- Workflow state uses colored StatusChip variants
- Inline state transition buttons: "Mark in progress", "Mark completed"

### 1.4 — Administration: Work Queue

**New frame: `Editor — Work Queue`** (1440px)

- Header: "My work queue" + logged-in user avatar/name
- Filter bar: All / Translation / Review / Approval
- Task list using existing `Editorial/Review Queue Item` component (`qbvZQ`)
- Each item: sermon title, paragraph range, task type badge, assigned date, "Open" button
- Empty state: illustration + "No tasks assigned"

### 1.5 — Search: Search Page

**New frame: `Search — Results`** (1440px)

Layout:
- Sticky search bar at top (full-width input, magnifier icon left, clear button right)
- Below search bar: tab row — "Full text / AI / Bible verse"
- Left: filter panel (collapsible) — Language, Series, Year range
- Right: results list

Result card:
- Sermon title + date chip
- Language badge + version badge
- Snippet: matched text with highlighted terms (bold or colored)
- Match type indicator: "Full text match" / "Semantic match" / "Bible verse match"
- Link: "Read paragraph →"

States:
- Loading: skeleton cards (3)
- Empty: "No results for [query]" + suggestions
- Initial (no query): "Search across all sermons" with example queries

### 1.6 — Search: Navbar Search

**New overlay: `Search — Navbar Typeahead`**

Triggered by clicking search icon in navbar:
- Input expands inline in navbar
- Dropdown below: up to 5 quick results (sermon title + snippet)
- "See all results →" footer link
- Keyboard: Enter → full search page, Escape → close

### 1.7 — Authentication: Login

**New frame: `Auth — Login`** (1440px)

Layout: centered card on dark background (matches site aesthetic)
- Logo / site name top
- Heading: "Sign in"
- Email input
- Password input
- "Sign in" primary button (full width)
- "Forgot password?" link below
- Separator + "Or continue with" → placeholder for SSO option
- Footer: link back to public sermon list

---

## Phase 2 — Reader Completion and Audio (depends on Phase 1 design being buildable)

### 2.1 — Audio Player Bar

**New component: `Audio Player Bar`** (reusable, pinned to bottom of viewport)

- Left: sermon title (truncated) + language badge
- Center: play/pause button (large), skip back 15s, skip forward 15s, progress bar with current time / total duration
- Right: playback speed selector (0.75x / 1x / 1.25x / 1.5x), close button
- Progress bar: draggable scrubber, shows buffered range in lighter color

**Update frame: `Sermon Reader`** — add audio player bar at bottom (collapsed / expanded states)

Active paragraph highlight during playback: existing paragraph background shifts to a subtle accent color (distinct from user highlights).

### 2.2 — Scripture Reference Tooltip

**New overlay: `Scripture Reference — Tooltip`**

Triggered by hovering/tapping underlined scripture text in a paragraph:
- Card: book + chapter:verse header
- Verse text (English KJV or Norwegian)
- Language toggle if available
- Dismiss on click-outside

---

## Phase 3 — Notes & Highlights Dashboard (depends on server-side implementation)

### 3.1 — Annotations Dashboard

**New frame: `Annotations — Dashboard`** (1440px)

Layout:
- Left: filter sidebar — All / Highlights / Notes, grouped by Sermon (tree list)
- Main: annotation cards list

Annotation card:
- Quoted text (highlight) or note body
- Sermon title + paragraph reference + language badge
- Color chip (for highlights)
- Date + edit/delete actions
- Click → deep-link to published reader at that paragraph

Empty state:
- "You have no annotations yet" + "Start reading" link

Header actions:
- "Export annotations" (JSON), "Import annotations"

---

## Phase 4 — Mobile Design (after core functionality is implemented)

### 4.1 — Mobile Sermon Reader (390px)

**New frame: `Mobile — Sermon Reader`**

- Single column, paragraph text full-width
- Collapsed toolbar: single icon row (font size, highlights, notes, share)
- Notes panel as bottom sheet (draggable, 80vh max)
- Audio player: compact bar pinned to bottom above BottomNav

### 4.2 — Mobile Sermons List (390px)

**New frame: `Mobile — Sermons Page`**

- Stacked sermon cards (no multi-column)
- Search bar full-width at top
- Filter as bottom sheet triggered by "Filter" chip

---

## Phase 5 — System States (after core functionality is implemented)

### 5.1 — Empty States

**New frame: `System States`** (design reference sheet, not a page)

Catalogue of empty state illustrations + copy for:
- Sermons list: no results for search/filter
- Work queue: no assigned tasks
- Annotations dashboard: no annotations yet
- Published versions: sermon has not been published yet
- Search: no results

### 5.2 — Error and Loading States

Add to `System States` frame:
- 404 page: "Page not found" + back link
- General error: "Something went wrong" + retry button
- Skeleton loaders: standardized for sermon cards, paragraph blocks, annotation cards

---

## Component Additions (in Design System)

These components are needed across multiple new frames and should be added to `JeK3D`:

| Component | Used in |
|-----------|---------|
| `StatusChip/Workflow` (ready/in_progress/completed) | Admin panel |
| `RoleBadge` (Translator/Proofreader/Reviewer/Publisher/Admin) | Admin, Work Queue |
| `SearchResultCard` | Search results |
| `AnnotationCard` | Annotations dashboard |
| `AudioPlayerBar` | Reader |
| `ScriptureTooltip` | Reader |
| `ExportDialog` | Publishing |
| `PublishConfirmModal` | Publishing |
| `EmptyState` (generic, configurable copy + icon) | All modules |

---

## Acceptance Criteria

Each frame is complete when:
1. All interactive states are represented (default, hover, disabled, empty, loading)
2. Components used are drawn from the Design System (no one-off styles)
3. Dark theme is consistent with existing frames
4. Frame is 1440px unless explicitly a mobile frame (390px)
5. Overlay frames include a realistic background (dimmed reader or sermon list)
