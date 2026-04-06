# Reader / Playback Module Specification

## Purpose and Scope
Purpose:
- Deliver a public reading and listening experience for published sermon translations.

In scope:
- Public access to published sermons
- Paragraph-based reading layout with language selection
- Audio playback (original and TTS integration path)
- Text/audio synchronization and scripture references
- Reader interactions (highlighting, notes, bookmarks via module interfaces)

Out of scope:
- Translation authoring or approval workflows
- User/role administration
- Publishing lifecycle operations

## Roles, Actors, and Permissions
- Public Reader: unauthenticated user who can browse and consume published content.
- Authenticated Reader: user with personal annotation and preference persistence.
- System Integrations: TTS provider integration (ElevenLabs) for translated playback.

Permission constraints:
- Public reads require no authentication for published content.
- Unpublished and editorial draft content is not readable via public reader endpoints.
- Personal interactions (notes/highlights/bookmarks) require user identity.

## Primary Workflows and Lifecycle States

### Public Reading Workflow
1. Reader requests sermon page.
2. System resolves latest published version (or explicit version).
3. Reader sees metadata, structured paragraphs, and scripture references.
4. Reader can switch language where published versions exist.

### Audio Playback Workflow
1. Reader starts original sermon audio, or translated TTS if available.
2. Playback engine maps timestamps to paragraph/sentence segments.
3. Active segment is highlighted during playback.
4. Seek operations update highlighted segment deterministically.

### Interaction Workflow
1. Reader selects text or paragraph.
2. Reader adds highlight, note, or bookmark.
3. Interaction data is saved through Notes & Highlights contracts.

## Data Ownership
Primary read dependencies:
- `sermonPublishedVersions`
- `sermonPublishedParagraphSnapshots`
- `sermons`

Delegated write dependencies:
- Notes/highlights/bookmarks are written through Notes & Highlights module ownership.

Ownership rules:
- Reader consumes immutable published snapshots as source for display.
- Reader must not read from mutable editorial translation tables for public rendering.

## Interface Expectations (Behavior-Level)
- `getPublishedReaderView(sermonId, language, version?)`: returns metadata, paragraph payload, and playback alignment.
- `listPublishedLanguages(sermonId)`: returns languages with published versions.
- `getPlaybackTrack(sermonId, language, version?, source)`: returns source audio or TTS metadata.
- `resolveScriptureReferences(sermonId, language, version?)`: returns linked references and display text.
- `saveReaderPrefs(userId, prefs)`: persists reader UI preferences.

Constraints:
- Reader payload must be version-consistent across metadata and paragraph content.
- Sync mapping must align playback offsets to stable published paragraph IDs.
- TTS playback is optional fallback content; missing TTS cannot block text reading.

## Failure Cases and Non-Goals
Failure cases:
- Missing published version returns explicit not-found state (not draft fallback).
- Playback desync events should degrade gracefully to paragraph-level sync.
- External TTS errors should surface as unavailable audio mode without affecting text rendering.

Non-goals:
- Real-time co-reading presence.
- In-reader editorial approval controls.
- Offline packaging in this version.

## Acceptance Criteria
- Unauthenticated users can read published sermons and metadata.
- Reader displays only published, version-consistent content.
- Language switching works across available published translations.
- Playback highlights track timestamps and update on seek.
- Reader interactions call Notes & Highlights APIs for persistence.
