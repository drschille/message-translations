# Message Translations — Product / Technical Spec

## 1. Summary

`message-translations` is a **React + Vite + Convex web application** for building and maintaining a **translated sermon archive** focused on the ministry of **William Marrion Branham**. The product is presented as a Norwegian-facing archive (`Branham.no`) with a public reading experience and a deeper editorial workflow for paragraph-by-paragraph translation, review, commenting, revision history, and publishing.

At a high level, the app is **not just a “translator”**. It is a **translation archive and editorial system** with these layers:

1. **Public archive UX** for browsing sermons
2. **Reader UX** for consuming translated sermons
3. **Proofreading / editorial UX** for drafting and approving translations
4. **Backend content model** for sermons, paragraph translations, revisions, comments, highlights, and published snapshots
5. **Import / migration utilities** for loading sermon metadata and maintaining data integrity

---

## 2. Product intent

### Primary goal
Create a digital archive where sermons can be:
- imported and stored,
- translated into Norwegian Bokmål (and potentially other languages),
- reviewed paragraph by paragraph,
- versioned and published,
- consumed in a polished public reading interface.

### Secondary goals
- Preserve sermon metadata and historical context
- Allow collaborative editorial review
- Keep a revision trail for translation changes
- Support a future multilingual archive beyond Norwegian
- Provide a modern, mobile-friendly reading experience

### Non-goals
Based on the current code, this project is **not** primarily:
- a generic machine translation service,
- a CLI translation tool,
- a general CMS,
- a full sermon search engine over transcript semantics,
- a finished enterprise workflow product.

It is much closer to a **specialized digital archive + translation workbench**.

---

## 3. Target users

### Public readers
People who want to:
- browse available sermons,
- filter/search by year or series,
- open a sermon and read the translation,
- download PDF / access audio when available.

### Editors / proofreaders
People who want to:
- split sermons into paragraphs,
- draft translations,
- submit paragraphs for review,
- approve translations,
- comment on paragraphs,
- inspect revision history,
- publish stable sermon versions.

### Archive maintainers
People who want to:
- import sermon metadata,
- repair missing records,
- run backfills and integrity checks,
- maintain publication/version state.

---

## 4. Current product shape

## Frontend stack
- React 19
- React Router 7
- Vite
- Tailwind CSS 4
- Motion / Framer-style page transitions
- i18next for UI localization
- Convex React client for backend data access

## Backend stack
- Convex database and server functions
- Convex queries, mutations, actions, and internal mutations

## Supporting libraries
- lucide-react icons
- Express and dotenv are present in dependencies
- `@google/genai` is installed but not central in the code inspected here

---

## 5. Main user journeys

### 5.1 Homepage
The landing page presents the site as a **digital archive** for Branham sermons and related material. It uses editorial / museum-like branding and acts as a gateway into the sermon archive.

**Main CTA paths:**
- Explore sermons
- Read about the ministry / archive mission

### 5.2 Sermon archive browsing
The archive page supports:
- full-text search over title/description/scripture,
- filtering by year,
- filtering by series,
- pagination,
- expandable sermon cards,
- links to text, audio, and PDF.

This is the main discovery surface for content.

### 5.3 Sermon reading
The sermon reader supports two modes:
- **Read mode**: translated text-focused reading experience
- **Proofread mode**: side-by-side source vs translated paragraph comparison

The reader includes:
- hero/header treatment for the sermon,
- font scaling,
- scroll progress,
- sermon details sidebar,
- export/import of private reader annotations,
- paragraph-level comments/history modals,
- paragraph edit workflow from within the reading view.

### 5.4 Editorial translation flow
For each paragraph, an editor can:
- open a draft for editing,
- save as draft,
- submit for review,
- approve a paragraph that is in review,
- view revision history,
- restore old revisions,
- comment on translation choices.

### 5.5 Publication flow
At the sermon level:
1. Paragraphs are translated and reviewed
2. Sermon proofreading state is set
3. Once the sermon is marked `done`, a new **published version** can be created
4. Publication creates paragraph snapshots for that version
5. Sermon metadata is updated with publication/version info

This gives the archive a stable, auditable publication history.

---

## 6. Information architecture / routes

The app currently exposes these routes:

- `/` — homepage
- `/sermons` — sermon archive / listing page
- `/sermons/:sermonId` — reader page for a sermon
- `/editor/sermons` — editorial sermon list page
- `/editor/sermons/:sermonId` — editorial reader/editor page
- `/about` — about / archive mission page

This implies a split between:
- **public consumption routes** and
- **editorial workspace routes**.

---

## 7. Core domain model

## 7.1 Sermons
A sermon record stores top-level metadata such as:
- title
- date
- description
- tag
- location
- scripture
- audio URL
- PDF URL
- transcript
- series
- proofreading state
- publication state/version metadata

### Purpose
This is the canonical content container for a sermon.

---

## 7.2 Sermon metadata translations
A sermon can have metadata translations per language, including:
- translated title
- translated description
- language code

### Purpose
Allows localized sermon listing/display without changing the base sermon record.

---

## 7.3 Sermon paragraphs
A sermon can be split into ordered paragraph units with:
- sermon ID
- order
- source text
- updated timestamp

### Purpose
Paragraphs are the editorial unit for translation and review.

---

## 7.4 Paragraph translations
Each paragraph can have one translation per language with:
- translated text
- language code
- status
- updated timestamp

### Supported statuses
- `draft`
- `drafting`
- `needs_review`
- `approved`

### Purpose
Tracks editorial maturity at the paragraph level.

---

## 7.5 Paragraph comments
A paragraph translation can have threaded comments with:
- body
- author name
- optional parent comment
- timestamp

### Purpose
Supports discussion/review of translation choices.

---

## 7.6 Paragraph revisions
A paragraph translation stores revision history with:
- snapshot text
- status at the time
- revision kind (`edit` or `restore`)
- optional reason
- optional restored-from revision reference
- author metadata
- timestamp

### Purpose
Provides auditability and rollback.

---

## 7.7 Published sermon versions
Published versions record:
- sermon ID
- version number
- language code
- proofreading state
- publication time
- optional reason
- author metadata

Related paragraph snapshots store the source and translated text frozen at publication time.

### Purpose
Creates immutable release snapshots of a sermon translation.

---

## 7.8 Reader/editor preferences
The system stores user-specific toolbar prefs such as:
- font size
- bookmarked state

### Purpose
Persist personal reading/editorial settings.

---

## 7.9 Selection highlights
Users can create paragraph text highlights with:
- color
- text range offsets
- selected text
- user identifier
- language

### Purpose
Supports annotation and study workflows.

---

## 7.10 Metrics
An `appMetrics` table stores aggregate counters such as total sermon count.

### Purpose
Avoids recomputing archive totals every time.

---

## 8. Language model

## Canonical language
The code strongly suggests that **Norwegian Bokmål (`nb`) is the canonical translation language** for the archive experience.

Rules inferred from the implementation:
- Sermon lists are localized using metadata translations
- Paragraph translations are language-specific
- Missing non-`nb` paragraph translations are auto-created from source text as draft placeholders
- Missing `nb` paragraph translations are treated as an integrity issue

This means the system assumes:
- source sermon text is usually English,
- Norwegian is the primary published translation target,
- additional languages may be added later.

---

## 9. Data ingestion and initialization

### 9.1 Sermon import
The repo includes import scripts and a backend action to import sermons from an external Branham dataset.

Imported sermon payloads can include:
- source metadata
- optional per-language translated metadata

Import behavior:
- validates translation payloads,
- inserts new sermons,
- updates existing sermons by tag,
- inserts or updates metadata translations,
- updates stored sermon count metrics.

### 9.2 Paragraph generation
When a sermon is first opened for editing/reading, the app can auto-generate paragraph records by:
1. splitting an existing transcript into paragraphs, or
2. falling back to seeded demo paragraph pairs if no transcript exists.

This is important: the current codebase still contains **demo/fallback data paths**, which means some content behavior is scaffolded rather than fully productionized.

### 9.3 Seeding
A `seed` mutation inserts a small demo sermon set if the database is empty.

Implication:
- the project is still in active setup / prototyping,
- it supports first-run demos and development environments.

---

## 10. Editorial workflow spec

### 10.1 Paragraph lifecycle
A paragraph translation moves through the following lifecycle:

1. **draft**
   - initial untranslated or placeholder state
2. **drafting**
   - actively being edited
3. **needs_review**
   - submitted for proofreading/review
4. **approved**
   - accepted as editorially approved

### 10.2 Sermon lifecycle
At the sermon level, the proofreading state is:
- `queued`
- `in_progress`
- `done`

### 10.3 Publish rule
A sermon can only be published when its proofreading state is `done`.

### 10.4 Publication side effects
Publishing:
- increments sermon version,
- creates a sermon-level published version record,
- snapshots all paragraph source/translation pairs,
- marks the sermon as published.

### 10.5 Review artifacts
The workflow is supported by:
- comments,
- revision history,
- restore operations,
- revert-to-last-approved operations.

---

## 11. Public reader behavior

The reader experience is intentionally more than a plain text page.

### Features
- rich hero presentation
- sidebars for progress and sermon details
- read mode and proofread mode
- paragraph-level actions
- notes/highlights support
- PDF/audio links
- mobile-friendly layout

### Editorial crossover
The current reader page mixes public reading and editorial actions. In practice, this means the reader doubles as a lightweight proofreading surface.

This is a notable product decision:
- it reduces page/context switching,
- but may blur the boundary between public and editorial users.

---

## 12. Search and filtering

The sermon archive list currently supports:
- title search
- description search
- scripture search
- year filter
- series filter
- paginated results

### Current implementation note
Filtering is done after loading sermon records and resolving localized metadata, rather than through a dedicated full-text search service.

### Implications
Good enough for moderate archive sizes, but may need redesign if the archive becomes very large.

---

## 13. Authentication and persistence

The code shows a mixed model:

### Auth-required features
Some mutations explicitly require authenticated identity, especially for:
- saving editor toolbar preferences,
- creating/deleting highlights,
- certain author-tracked operations.

### Soft-auth / anonymous-compatible features
Other actions use identity if available but still fall back to anonymous author names.

### Product implication
The app currently behaves more like a **trusted internal editorial workspace** than a strict role-based system.

A future production version should probably define:
- public reader permissions,
- editor permissions,
- reviewer permissions,
- publisher/admin permissions.

---

## 14. Integrity and maintenance utilities

The backend includes several operational maintenance functions:
- backfill metadata translations
- backfill sermon totals
- assert Norwegian translation integrity
- inspect missing paragraph translations in chunks
- clean up legacy paragraph fields
- repair missing Norwegian translations from fallback sources

This shows the project is actively evolving its data model and already needs migration/repair tooling.

That is usually a sign of a product transitioning from prototype to real archive operations.

---

## 15. What the project is really doing

In product terms, this repo is best described as:

> A specialized sermon archive and editorial translation platform for William Branham content, centered on Norwegian translation, paragraph-level review, and publishable version history.

That description is more accurate than simply calling it a “message translation” app.

---

## 16. Strengths of the current design

### Clear editorial unit
Paragraph-based translation is a strong choice for reviewability and version control.

### Revision-first architecture
The presence of revisions, restore flows, and published snapshots is a major strength.

### Public + editorial bridge
The system already supports both archive consumption and editorial work in one codebase.

### Multilingual-ready foundations
Even if Norwegian is the primary target, the schema is language-aware and extensible.

### Operational realism
Import, backfill, integrity, and repair tooling suggest the maintainer is thinking about long-term data health.

---

## 17. Weaknesses / product risks

### 17.1 Repo name is misleading
`message-translations` sounds generic, but the app is domain-specific and sermon-focused.

### 17.2 Mixed prototype and production signals
The codebase includes:
- polished public UI,
- real editorial workflow,
- but also seed/demo data and fallback paragraph content.

That makes the current maturity level feel transitional.

### 17.3 Access control is not fully hardened
Editorial actions and public reading concerns are somewhat interwoven.

### 17.4 Scalability of archive querying
Current sermon listing looks collection-scan based. That may become expensive as content grows.

### 17.5 Hard-coded or placeholder content still exists
Some content in the reader/about experience appears static or decorative rather than data-driven.

---

## 18. Recommended product framing

If this project were to be documented clearly, I would describe it as:

## Product name
Branham.no Translation Archive

## One-line description
A web-based archive and editorial workspace for translating, reviewing, and publishing William Branham sermons in Norwegian.

## Short description
The platform lets maintainers import sermon metadata, generate paragraph-level translation units, collaborate on proofreading, preserve revision history, and publish stable sermon versions for public reading.

---

## 19. Recommended future improvements

### Product / UX
- Separate public reader and editorial controls more clearly
- Add explicit role-based permissions
- Add dashboard metrics for editorial progress
- Add richer sermon/source metadata management
- Show translation completion at archive level

### Data / backend
- Add proper indexed search for large archives
- Add explicit source-language metadata per sermon
- Add bulk paragraph import/export
- Add machine-translation assist workflow with human review gates
- Add publication diffing between versions

### Editorial workflow
- Add reviewer assignment
- Add sermon-level checklist before publish
- Add unresolved-comment warnings
- Add paragraph lock / concurrent editing rules

### Reader workflow
- Persist bookmarks and notes more consistently
- Add audio/text sync if timestamps become available
- Add verse/scripture linking
- Add related-sermon navigation driven by data instead of placeholders

---

## 20. Final assessment

This repository is a **domain-specific archive application** for sermon translation and preservation.

Its real value is in the combination of:
- archive browsing,
- localized metadata,
- paragraph-level translation editing,
- review comments,
- revision history,
- versioned publication.

So the most faithful spec-level interpretation is:

> `message-translations` is a translation editorial platform for a sermon archive, with a public reading interface and Convex-backed workflow for drafting, review, integrity checks, and publication.

