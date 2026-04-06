# GAP-analyse: Message Translations Platform

## Context

Prosjektet har et komplett sett med modulspesifikasjoner (6 moduler + kjerne) og sterk implementasjon for Translation/Editorial og delvis Reader. Det mangler implementasjon for tre store moduler (Administration, Publishing/Export, Search) og delvise gap i Reader/Playback og Notes & Highlights.

Målet er en komplett, spec-drevet plattform for å bevare, oversette, publisere og konsumere preken-innhold.

---

## GAP-liste med oppgaver

### GAP 1 — Publishing / Export (10% implementert)

Schema finnes (`sermonPublishedVersions`, `sermonPublishedParagraphSnapshots`), men ingen logikk.

**Oppgave 1.1 — Backend: Valider publiseringsberedskap**
- Implementer `validatePublishReadiness(sermonId, language)` i `convex/publishing.ts`
- Sjekk at alle paragraf-oversettelser for (sermonId, language) er i `approved`-status
- Returner liste over ikke-godkjente paragrafer ved feil

**Oppgave 1.2 — Backend: Publish-aksjon**
- Implementer `publishSermonVersion(sermonId, language, requestedBy)` i `convex/publishing.ts`
- Kall `validatePublishReadiness` først (kast feil hvis ikke klar)
- Lag ny versjon (increment) i `sermonPublishedVersions`
- Materialiser snapshot-rader i `sermonPublishedParagraphSnapshots`
- Logg publish-hendelse med aktør + tidsstempel
- Eksisterende versjoner er uforanderlige (append-only)

**Oppgave 1.3 — Backend: Lese publiserte versjoner**
- `listPublishedVersions(sermonId, language)` → alle versjoner for et sermon+språk
- `getPublishedSermon(sermonId, language, version?)` → snapshot (siste versjon hvis utelatt)

**Oppgave 1.4 — Backend: Export**
- `exportPublishedSermon(sermonId, language, version, format: 'json'|'csv')` i `convex/publishing.ts`
- Les utelukkende fra snapshot-tabeller
- Generer JSON eller CSV-artefakt med metadata
- Logg eksport-hendelse

**Oppgave 1.5 — Frontend: Publish-kontroller i EditorSermonsPage**
- Knapp «Publiser oversettelse» for godkjente sermoner
- Valideringsmelding ved manglende godkjente paragrafer
- Vis publiseringshistorikk (versjonsliste)

**Oppgave 1.6 — Frontend: Export-nedlasting**
- Last ned-knapp for publiserte versjoner (JSON/CSV)
- Vist på både `EditorSermonsPage` og `ReaderPage`

**Oppgave 1.7 — Tester: Publishing-modul**
- Unit-tester for publish-validering (manglende godkjenninger → feil)
- Unit-tester for snapshot-materialisering
- Unit-tester for immutabilitet (ny versjon ved republisering)

---

### GAP 2 — Administration (5% implementert)

Ingen bruker-/rolle-/oppdragssystem eksisterer.

**Oppgave 2.1 — Backend: Bruker- og rollehåndtering**
- Ny fil `convex/administration.ts`
- `createUser(profile)`, `deleteUser(userId)`, `assignRoles(userId, roles[])`
- Bruk `tokenIdentifier` som bruker-ID (konsistent med eksisterende mønstre)
- Kapabilitetsmatrise: roller → tillatte handlinger

**Oppgave 2.2 — Backend: Sermon workflow-orchestrering**
- `markSermonWorkflowState(sermonId, state: 'ready'|'in_progress'|'completed')`
- Legg til `workflowState`-felt i `sermons`-tabellen (schema-migrasjon)
- Valider overganger (kun autoriserte overganger tillatt)

**Oppgave 2.3 — Backend: Oppgavetildeling**
- `assignTask(taskType, target, assignee)`, `reassignTask(taskId, assignee)`
- `getWorkQueue(userId)` → liste over oppgaver for bruker
- Lag `tasks`-tabell i schema (type, target, assignee, status, createdAt)

**Oppgave 2.4 — Frontend: Admin-panel**
- Ny rute `/admin` med `AdminPage.tsx`
- Brukerlistings + rolletildeling
- Sermon-workflowoversikt (klar/i gang/fullført)
- Oppgavefordeling per bruker

**Oppgave 2.5 — Frontend: Work Queue UI**
- Ny rute `/editor/queue` med `WorkQueuePage.tsx`
- Vis tildelte oppgaver for innlogget bruker
- Direktelenker til sermoner/paragrafer

---

### GAP 3 — Search (5% implementert)

Nullimplementasjon. Schema (`searchIndexJobs`, `searchQueryLogs`, `searchEmbeddingVectors`) eksisterer.

**Oppgave 3.1 — Backend: Fulltekstsøk**
- `searchFullText(query, filters, scope)` i ny `convex/search.ts`
- Bruk Convex innebygd fulltekstsøk-indeks (`searchIndex` i schema)
- Støtt frase-søk og boolske operatorer
- Returner hits med snippet/fragmenter

**Oppgave 3.2 — Backend: AI-semantisk søk**
- `searchAI(query, filters, scope)`
- Integrer Google GenAI (allerede installert: `@google/genai`) for embeddings
- Generer embedding for søkespørring → cosine-likhet mot `searchEmbeddingVectors`
- Returner topp-k resultater med score

**Oppgave 3.3 — Backend: Bibelvers-søk**
- `searchByBibleVerse(reference, filters, scope)`
- Normaliser referanser (f.eks. «Joh 3:16» → standardformat)
- Matcher eksplisitte og relaterte kontekster

**Oppgave 3.4 — Backend: Indekseringspipeline**
- `reindexSermon(sermonId, language?, scope)` og `reindexAll(scope)`
- Indeksjobbstyring via `searchIndexJobs` (queued → running → succeeded/failed)
- Kjør ved innholds-endringer i editorial-arbeidsflyt

**Oppgave 3.5 — Frontend: Søkeside**
- Ny rute `/search` med `SearchPage.tsx`
- Søkefelt + resultatvisning med snippets
- Faner: fulltekst / AI / bibelvers
- Filtreringsmuligheter (language, series, year)

**Oppgave 3.6 — Frontend: Søk i eksisterende sider**
- Integrer søk i `TranslationsPage.tsx` (allerede har en søkestreng-prop)
- Søkebar i navigasjon (`Navbar.tsx`)

---

### GAP 4 — Reader / Playback (60% implementert)

UI for lyd eksisterer men er ikke funksjonelt.

**Oppgave 4.1 — Backend: Reader API**
- `getPublishedReaderView(sermonId, language, version?)` i `convex/reader.ts`
- Kombiner metadata + paragrafer fra publiserte snapshot-tabeller
- `listPublishedLanguages(sermonId)` → tilgjengelige språk

**Oppgave 4.2 — Backend: Lydspor-integrasjon**
- `getPlaybackTrack(sermonId, language, version?, source)`
- Returner `audioUrl` fra `sermons`-tabellen
- Forbered struct for TTS-fallback (ElevenLabs-klar, men ikke tving implementasjon)

**Oppgave 4.3 — Backend: Skrift-referanse-løsning**
- `resolveScriptureReferences(sermonId, language, version?)`
- Ekstraher og normaliser skrift-referanser fra paragraftekst
- Returner annoterte referanser med lenker

**Oppgave 4.4 — Frontend: Funksjonell lydavspilling**
- Koble lydknapper til faktisk HTML5 `<audio>`-element i `ReaderPage.tsx`
- Implementer play/pause/seek-kontroller
- Marker aktiv paragraf under avspilling (basert på tidsstempler om tilgjengelig)

**Oppgave 4.5 — Frontend: ReaderPage fra publiserte snapshots**
- Oppdater `ReaderPage.tsx` til å lese fra publiserte snapshot-tabeller (ikke rå oversettelser)
- Versjonsvelger-UI (default = siste versjon)

---

### GAP 5 — Notes & Highlights (70% implementert)

IndexedDB fungerer, men mangler server-side persistens og dashboard.

**Oppgave 5.1 — Backend: Server-side annotasjonspersistens**
- Opprettelse av `userHighlights`- og `userNotes`-tabeller i schema (om ikke allerede modellert)
- `createHighlight(userId, sermonId, language, version, selection, style)` i `convex/annotations.ts`
- `updateHighlight`, `deleteHighlight`, `createNote`, `updateNote`, `deleteNote`
- Eiersjekk obligatorisk på alle mutasjoner

**Oppgave 5.2 — Backend: Annotasjonslisting og eksport**
- `listUserAnnotations(userId, filters)` med filtrering på sermon/dato/language
- `exportUserAnnotations(userId)` → JSON-eksport
- `importUserAnnotations(userId, payload)` med schema-validering og deduplisering

**Oppgave 5.3 — Frontend: Annotasjonsdashboard**
- Ny rute `/annotations` med `AnnotationsDashboard.tsx`
- Gruppert etter sermon/dato/språk
- Filtrer/søk i egne notater og markeringer

**Oppgave 5.4 — Migrasjon: IndexedDB → server-side**
- Migrasjonshjelper som eksporterer IndexedDB-data og importerer til server via `importUserAnnotations`
- Vis engangs-migreringsmelding til innloggede brukere

---

### GAP 6 — Kryssmodul-infrastruktur (mangler)

**Oppgave 6.1 — Autentisering og autorisasjon**
- Integrer Convex Auth (eller eksisterende token-system)
- Kapabilitetsmatrise håndhevet i backend-funksjoner
- Skill uautoriserte fra autoriserte brukere konsistent

**Oppgave 6.2 — Auditlogg**
- Konsistent aktør+tidsstempel logging på alle mutasjoner (editorial har dette delvis)
- Sentraliser logiklaget i et Convex-hjelpeobjekt (f.eks. `withAudit(ctx, fn)`)

**Oppgave 6.3 — Feilhåndtering og standardisering**
- Standardiser feilmeldingsformat på tvers av Convex-funksjoner
- Frontend: konsistente toast-meldinger / feilvisning

---

## GAP 7 — Design / UX (design/mt.pen)

### Hva som ER designet (12 frames i mt.pen)

| Frame | Dekker |
|-------|--------|
| Landing Page | Hero, sermonslist, om oss, footer |
| Sermons Page | Søk, filter, paginert liste |
| Sermon Reader | Lesemodus, fargepunkter, verktøylinje |
| Sermon Reader — Panel Open | Leser med notater/høydepunkter-panel åpent |
| Comparison Reader | Splitvisning Engelsk/Norsk side om side |
| Sermon Reader — Proofreading | Korrekturlesing med avatarindikatorer per paragraf |
| Version History Overlay | Versjonsliste med sammenlign/gjenopprett |
| Comments Overlay | Trådet kommentar-modal |
| Notes Panel (Expanded) | Sidepanel med høydepunkter og notater |
| Design System (R9tUP + JeK3D) | Typografi, farger, komponenter, layout-mønstre |

---

### Design-GAP 7.1 — Søkeside (ikke designet)

Ingen design for søk eksisterer. Spec krever fulltekst, AI, og bibelvers-søk.

**Oppgave 7.1.1 — Design: Søkeside**
- Side med søkefelt, fane-navigasjon (Fulltekst / AI / Bibelvers)
- Resultatkorter med snippet, sermontittel, språk, versjon-badge
- Filter-panel (år, serie, språk)
- Tilstandsdesign: tomt søk, ingen resultater, laster

**Oppgave 7.1.2 — Design: Søk i Navbar**
- Utvidbar søkebar i navigasjonen (ikon → input)
- Hurtigresultater / typeahead-dropdown

---

### Design-GAP 7.2 — Administrasjonspanel (ikke designet)

Ingen design for bruker-/rolle-/oppgavehåndtering.

**Oppgave 7.2.1 — Design: Admin-oversikt**
- Brukerliste med rolle-badges (Oversetter / Korrekturleser / Redaktør / Utgiver)
- Rolletildeling-modal (inline eller slide-over)
- Sermonarbeidsflytstatus-tabell (klar / i gang / fullført)

**Oppgave 7.2.2 — Design: Arbeidskø**
- Oppgaveliste per bruker (tildelte paragrafer/sermoner)
- Direktelenke til editorial-visning
- Prioritet og frister

---

### Design-GAP 7.3 — Publisering og eksport (ikke designet)

Publiserings- og eksportflyten mangler helt.

**Oppgave 7.3.1 — Design: Publiseringsknapp og bekreftelsessteg**
- Publiser-knapp på `EditorSermonsPage` (inaktiv hvis ikke klar)
- Validerings-modal: viser antall ikke-godkjente paragrafer
- Bekreftelsesdialog med versjonsnummer og forfatter

**Oppgave 7.3.2 — Design: Versjonsoversikt**
- Liste over publiserte versjoner per sermon+språk
- Tidslinje med versjonsnummer, dato, utgiver

**Oppgave 7.3.3 — Design: Eksport-dialog**
- Formatvelger (JSON / CSV)
- Versjonvelger
- Last ned-knapp

---

### Design-GAP 7.4 — Autentisering (ikke designet)

Ingen login/signup-sider er designet.

**Oppgave 7.4.1 — Design: Login-side**
- Minimalistisk innloggingsform (e-post + passord eller SSO)
- Konsistent med design system (mørkt tema, typografi)

---

### Design-GAP 7.5 — Annotasjonsdashboard (ikke designet)

Notes Panel er designet som sidepanel i leseren, men ingen frittstående dashboardside.

**Oppgave 7.5.1 — Design: Annotasjonsdashboard**
- Fullside-visning av alle egne notater og høydepunkter
- Gruppert etter sermon / dato / språk
- Søk/filter i egne annotasjoner
- Eksport/import-knapper

---

### Design-GAP 7.6 — Lydavspilling (ikke designet funksjonelt)

Leseren viser fargepunkter og knapper, men ingen dedikert lydspiller-UI.

**Oppgave 7.6.1 — Design: Audio Player-komponent**
- Persistent player-bar (bunn eller topp av skjermen)
- Play/pause, spol frem/tilbake, tidslinje med progresjon
- Aktiv paragraf-markering synkronisert med avspilling

---

### Design-GAP 7.7 — Mobildesign (ikke designet)

Alle 12 frames er 1440px desktop. Ingen mobil-breakpoints finnes.

**Oppgave 7.7.1 — Design: Mobilversjon av leser (390px)**
- Enkeltkolonne-layout for reader
- Sammenkollapsbar verktøylinje
- Notater-panel som bunnark (bottom sheet)

**Oppgave 7.7.2 — Design: Mobilversjon av sermonsside**
- Stablede sermoner-kort
- Filter som bunnark

---

### Design-GAP 7.8 — Systemtilstander (ikke designet)

Ingen tomme tilstander, feilsider eller lasteindikatorer er formelt designet.

**Oppgave 7.8.1 — Design: Tomme tilstander**
- Ingen sermoner funnet (søk uten treff)
- Ingen notater ennå
- Ingen publiserte versjoner

**Oppgave 7.8.2 — Design: Feil og loading**
- 404-side
- Generell feilside
- Skeleton-loaders (allerede brukt i kode, bør standardiseres)

---

### Design-GAP 7.9 — Skrift-referanse-visning (ikke designet)

Spec nevner skriftreferanser i leseren, men ingen design for dette.

**Oppgave 7.9.1 — Design: Skriftreferanse-tooltip/panel**
- Inline tooltip ved hover på bibelreferanser
- Eller utvidbart panel i sidemargen

---

### Sammendrag: Design-dekning per modul

| Modul | Design-status |
|-------|--------------|
| Reader / Playback | 70% — mangler lydspiller, mobil, skriftreferanse |
| Translation / Editorial | 85% — proofreading, kommentarer, versjon designet |
| Notes & Highlights | 60% — panel designet, dashboard mangler |
| Publishing / Export | 0% — ingenting designet |
| Administration | 0% — ingenting designet |
| Search | 0% — ingenting designet |
| Autentisering | 0% — ingen login-sider |
| Systemtilstander | 10% — kun implisitt via shimmer-komponenter |

---

## Implementasjonsrekkefølge (anbefalt)

```
1. GAP 7 (Design) — Publishing, Admin, Search, Auth  [design-first]
2. GAP 1 — Publishing/Export backend               (blokkerer Reader fra publisert innhold)
3. GAP 4 — Reader fullføring                       (avhenger av publiserte snapshots + lyddesign)
4. GAP 5 — Notes & Highlights server-side          (avhenger av publiserte versjoner som ankere)
5. GAP 2 — Administration                          (uavhengig, men viktig for flyt-styring)
6. GAP 3 — Search                                  (avhenger av indeksert publisert innhold)
7. GAP 6 — Infrastruktur                           (kan paralleliseres, men best tidlig)
8. GAP 7 (Design) — Mobil, systemtilstander        [etter kjernefunksjonalitet]
```

## Kritiske filer for modifikasjon

- [convex/schema.ts](../convex/schema.ts) — Legg til `tasks`, evt. `workflowState` på sermons
- [convex/editorial.ts](../convex/editorial.ts) — Hook inn indeksering ved statusendringer
- [src/App.tsx](../src/App.tsx) — Nye ruter: `/admin`, `/editor/queue`, `/search`, `/annotations`
- [src/components/ReaderPage.tsx](../src/components/ReaderPage.tsx) — Publiserte snapshots + lyd
- Nye filer: `convex/publishing.ts`, `convex/administration.ts`, `convex/search.ts`, `convex/reader.ts`, `convex/annotations.ts`

## Verifisering

- Publisering: Opprett sermon med alle approved paragrafer → kall publish → verifiser snapshot-rader
- Export: Last ned JSON/CSV → verifiser struktur matcher spec
- Search: Indekser en sermon → søk etter frase → verifiser hit med snippet
- Reader: Naviger til publisert sermon → verifiser kun snapshot-data vises (ikke rå)
- Admin: Tildel rolle → verifiser kapabilitetsmatrise håndheves i backend
