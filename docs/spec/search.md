# Search Module Specification

## Purpose and Scope
Purpose:
- Provide fast, accurate, multilingual discovery across sermons and paragraphs using multiple retrieval methods.

In scope:
- Full-text search
- AI semantic search
- Bible verse to sermon paragraph search
- Direct quote search
- Elasticsearch vector/embedding search
- Ranking, filtering, and result highlighting

Out of scope:
- Editing canonical or translated content
- Publishing workflows
- User/role administration

## Roles, Actors, and Permissions
- Public Reader: can run search against published content.
- Authenticated Reader: same search capabilities with optional personalization signals.
- Editor/Reviewer/Publisher/Admin: can search unpublished/editorial scopes when authorized.
- System Indexer: internal actor that builds and updates indices.

Permission constraints:
- Public endpoints only search published snapshots.
- Editorial/unpublished search scopes require authenticated role checks.
- Search logs and analytics are restricted to authorized operational roles.

## Primary Workflows and Lifecycle States

### Indexing Lifecycle
States:
- `queued`
- `running`
- `succeeded`
- `failed`

Workflow:
1. Content changes or publish events enqueue index jobs.
2. Indexer prepares normalized documents and embeddings.
3. Engine writes full-text and vector index entries.
4. Job status is recorded with duration and error data if failed.

### Search Request Workflow
1. User/client submits query with mode and filters.
2. System routes query to one or more retrieval strategies.
3. Results are ranked, deduplicated, and annotated with explanation metadata.
4. Response returns sermon and paragraph hits with anchors for reader navigation.

## Data Ownership
Primary write ownership:
- `searchIndexJobs`
- `searchQueryLogs`
- `searchEmbeddingVectors` (or equivalent vector store mapping)
- External Elasticsearch indices for lexical and vector retrieval

Read dependencies:
- `sermons`
- `sermonParagraphs`
- `sermonMetadataTranslations`
- `sermonParagraphTranslations`
- `sermonPublishedVersions`
- `sermonPublishedParagraphSnapshots`

Ownership rules:
- Search indexes derivative retrieval representations and never mutates source content.
- Published search uses immutable published snapshots as its source dataset.

## Interface Expectations (Behavior-Level)
- `searchFullText(query, filters, scope)`: lexical matching across metadata and paragraph text.
- `searchAI(query, filters, scope)`: semantic retrieval using LLM-assisted or embedding-based interpretation.
- `searchByBibleVerse(reference, filters, scope)`: resolves verse references and returns linked sermon paragraphs.
- `searchDirectQuotes(quote, filters, scope)`: exact/near-exact phrase matching with confidence and offsets.
- `searchEmbeddings(queryVectorOrText, filters, scope)`: vector similarity search through Elasticsearch embeddings.
- `reindexSermon(sermonId, language?, scope)`: rebuilds lexical/vector index entries for target sermon.
- `reindexAll(scope)`: full rebuild operation for disaster recovery or algorithm changes.

Common response contract:
- `hits[]` with `sermonId`, `paragraphId?`, `language`, `version?`, `score`, `matchType`, `snippet`, `anchors`.
- `explanations[]` describing contributing strategies and weighted scores.
- `pagination` and `latencyMs`.

Constraints:
- Query mode must be explicit or default to configured blended search.
- Result scope must enforce authorization and publication status constraints.
- Index writes must be idempotent for repeated events.

## Search Methods and Behavior

### Full-Text Search
- Uses lexical tokenization and analyzers for metadata and paragraph content.
- Supports phrase search, boolean operators, and language-aware stemming where configured.

### AI Search
- Interprets natural-language intent and retrieves semantically similar paragraphs/sermons.
- Can blend lexical precision with semantic recall for better relevance.

### Bible Verse to Sermon Paragraph Search
- Accepts normalized references (example: `John 3:16`).
- Matches explicit scripture references and related paragraph context.
- Returns verse-linked paragraphs with sermon metadata context.

### Direct Quotes Search
- Prioritizes exact string matches, then near matches by token distance.
- Returns quote offsets/snippets to jump directly to matching paragraph regions.

### Elasticsearch Embedding Search
- Stores and queries vector embeddings in Elasticsearch vector indices.
- Supports cosine/dot-product similarity and configurable top-k retrieval.
- Can hybrid-rank vector hits with full-text scores.

## Failure Cases and Non-Goals
Failure cases:
- Stale index detection must surface degraded mode metadata in responses.
- Failed index jobs must be retryable with clear diagnostics.
- Missing embeddings should gracefully fall back to lexical-only search.
- Verse parser ambiguity should return suggestions instead of empty hard failures.

Non-goals:
- Guaranteeing doctrinal interpretation correctness.
- Cross-tenant global search (single product corpus assumed).
- Real-time indexing guarantees below infrastructure-defined consistency windows.

## Acceptance Criteria
- Users can execute all five search methods with consistent response shape.
- Public searches return only published content; protected scopes enforce authorization.
- Reindex jobs are observable, retryable, and idempotent.
- Bible verse queries resolve to relevant sermon paragraphs with stable anchors.
- Direct quote search returns exact/near matches with usable snippets.
- Hybrid lexical + vector retrieval improves recall without breaking precision baselines.
