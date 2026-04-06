# Core Product Specification: Modular Sermon Translation & Publishing

## 1. Product Vision
Build a modular and extensible platform around the sermons of William Marrion Branham that preserves canonical source material, supports AI-assisted translation with human review, and publishes reliable multilingual reading experiences.

One-line summary: a modular system for preserving, translating, reviewing, publishing, and consuming sermon content with auditable workflows and immutable publication snapshots.

## 2. Core Domain Model

### 2.1 Canonical Entity: Sermon
The system is anchored on an English sermon corpus that is immutable and authoritative.

Each sermon includes:
- Metadata: title, date, location, series, scripture references
- Media: original audio recording, transcript
- Structure: paragraph segmentation and timestamp alignment for playback

### 2.2 Canonical Data Rules
- English transcript and aligned metadata are the source of truth.
- Translations are derivative content; they do not overwrite canonical English fields.
- Paragraph identity is stable over time and is shared by all modules.

## 3. Architecture

### 3.1 Core + Modules
Core:
- Sermons (English canonical corpus)

Modules:
- Translation / Editorial
- Administration
- Publishing / Export
- Reader / Playback
- Notes & Highlights
- Search

Each module is independently evolvable but operates on shared core entities and identifiers.

### 3.2 Cross-Module Invariants
- Canonical immutability: English source fields are never mutated by translation workflows.
- Auditability: all editorial changes are attributable and timestamped.
- Versioning: translation changes are revisioned and reversible.
- Publishing immutability: every published version is a frozen snapshot.
- Shared identifiers: sermon and paragraph IDs are consistent across modules.

## 4. Shared Data Model and Ownership

### 4.1 Core Tables
- `sermons`
- `sermonParagraphs`

### 4.2 Translation and Editorial
- `sermonMetadataTranslations`
- `sermonParagraphTranslations`
- `paragraphTranslationRevisions`
- `paragraphTranslationComments`

### 4.3 Publishing
- `sermonPublishedVersions`
- `sermonPublishedParagraphSnapshots`

### 4.4 Reader Preferences and Annotations
- `paragraphSelectionHighlights`
- `editorToolbarPrefs`

### 4.5 Search and Retrieval
- `searchIndexJobs`
- `searchQueryLogs`
- `searchEmbeddingVectors`
- External search engine indices (Elasticsearch full-text and vector indices)

### 4.6 Ownership Rules
- Core tables are owned by Core and read by all modules.
- Translation / Editorial owns mutable translation-state tables.
- Publishing owns immutable published snapshot tables.
- Notes & Highlights owns personal user annotation/preferences tables.
- Search owns indexing, retrieval configuration, and query telemetry.

## 5. Module Specification Map
Module-level contracts are defined in separate files:

- [Translation / Editorial](./spec/translation-editorial.md)
- [Administration](./spec/administration.md)
- [Publishing / Export](./spec/publishing-export.md)
- [Reader / Playback](./spec/reader-playback.md)
- [Notes & Highlights](./spec/notes-highlights.md)
- [Search](./spec/search.md)

These module specs inherit the invariants in this document. In case of conflict, this core specification is authoritative.
