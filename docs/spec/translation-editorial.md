# Translation / Editorial Module Specification

## Purpose and Scope
Purpose:
- Produce high-quality sermon translations through AI-assisted drafting and human editorial review.

In scope:
- Paragraph-level translation authoring and refinement
- Editorial lifecycle management
- Revision history and comment threads
- Translation progress tracking
- Translation task generation and assignment hooks

Out of scope:
- User account lifecycle management (Administration)
- Publishing immutable versions (Publishing / Export)
- Public playback rendering (Reader / Playback)

## Roles, Actors, and Permissions
- Translator: create and edit draft translations, submit for review.
- Proofreader: review language quality and completeness, request changes.
- Reviewer: approve translation paragraphs for publication readiness.
- Publisher: read editorial status, publish only approved content.
- Admin: override role assignments and workflow configuration.

Permission constraints:
- Only authorized editorial roles can edit translation content.
- Approval actions require reviewer-level permission.
- State transitions are permission-gated and auditable.

## Primary Workflows and Lifecycle States

### Paragraph Translation Lifecycle
States:
- `drafting`
- `draft`
- `needs_review`
- `approved`

Required transitions:
- `drafting -> draft` on save.
- `draft -> needs_review` on submit.
- `needs_review -> draft` when review requests revisions.
- `needs_review -> approved` when reviewer accepts.
- `approved -> draft` only via explicit rollback action with revision reason.

### AI-Assisted Drafting Workflow
1. Translator selects target language and paragraph scope.
2. System generates candidate translation per paragraph.
3. Translator edits and saves draft.
4. Translator submits for review.

### Revision Workflow
1. Any material text/status change creates a revision snapshot.
2. Reviewers/editors compare revisions.
3. Restore operation can revert content to a previous revision, creating a new revision entry.

### Comment Workflow
1. Editors add paragraph-level comments.
2. Threads remain linked to paragraph translation and revision context.
3. Comment history is retained for audit purposes.

## Data Ownership
Primary write ownership:
- `sermonMetadataTranslations`
- `sermonParagraphTranslations`
- `paragraphTranslationRevisions`
- `paragraphTranslationComments`

Read dependencies:
- `sermons`
- `sermonParagraphs`

Ownership rules:
- Translation module writes only derivative translation entities.
- Canonical English source in core tables remains unchanged.

## Interface Expectations (Behavior-Level)
- `startAIDraft(language, sermonId, paragraphIds[])`: creates/upserts `drafting` records for target language.
- `saveTranslationDraft(translationId, text, reason?)`: persists text and writes revision entry.
- `submitForReview(translationId)`: validates required fields and transitions to `needs_review`.
- `approveTranslation(translationId)`: transitions to `approved` if reviewer permission and content checks pass.
- `requestRevision(translationId, note)`: returns status to `draft` with required reviewer note.
- `restoreRevision(translationId, revisionId, reason)`: restores snapshot through append-only revision creation.
- `addTranslationComment(translationId, body, parentCommentId?)`: appends comment entry.
- `getTranslationProgress(sermonId, language)`: returns percent translated/reviewed/approved.

Constraints:
- One active translation record per `(paragraphId, language)`.
- All state mutations must capture actor and timestamp.
- Approval cannot occur without non-empty translated text.

## Failure Cases and Non-Goals
Failure cases:
- AI generation timeout or provider failure should not change approved content.
- Concurrent edits must be conflict-safe and retain both attempts in audit logs.
- Invalid state transitions are rejected and logged.

Non-goals:
- Automatic publishing on approval.
- Semantic doctrinal validation by the system.
- Real-time multiplayer editing in this version.

## Acceptance Criteria
- Editorial roles can execute allowed transitions and are blocked from unauthorized ones.
- Every text/status change creates a revision record with actor and timestamp.
- Reviewers can compare and restore revisions without losing history.
- Progress metrics correctly reflect paragraph states at sermon level.
- Canonical English sermon and paragraph records are never mutated by this module.
