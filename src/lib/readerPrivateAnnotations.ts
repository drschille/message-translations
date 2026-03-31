export type HighlightColor = "yellow" | "blue" | "green" | "red";

export type PrivateHighlight = {
  id: string;
  sermonId: string;
  languageCode: string;
  paragraphId: string;
  color: HighlightColor;
  startOffset: number;
  endOffset: number;
  selectedText: string;
  updatedAt: number;
};

export type PrivateComment = {
  id: string;
  sermonId: string;
  languageCode: string;
  paragraphId: string;
  body: string;
  parentId: string | null;
  authorName: string;
  createdAt: number;
  updatedAt: number;
};

export type PrivateToolbarPrefs = {
  sermonId: string;
  languageCode: string;
  fontSizePx: number;
  bookmarked: boolean;
  updatedAt: number;
};

export type ReaderPrivateAnnotationsExportV1 = {
  schemaVersion: 1;
  exportedAt: number;
  sermonId: string;
  languageCode: string;
  highlights: PrivateHighlight[];
  comments: PrivateComment[];
  toolbarPrefs: PrivateToolbarPrefs | null;
};

const DB_NAME = "mt-reader-private-annotations";
const DB_VERSION = 1;
const HIGHLIGHTS_STORE = "highlights";
const COMMENTS_STORE = "comments";
const TOOLBAR_PREFS_STORE = "toolbarPrefs";

function keyForToolbarPrefs(sermonId: string, languageCode: string) {
  return `${sermonId}:${languageCode}`;
}

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

function txDone(tx: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
  });
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(HIGHLIGHTS_STORE)) {
        const highlights = db.createObjectStore(HIGHLIGHTS_STORE, { keyPath: "id" });
        highlights.createIndex("by_sermon_and_language", ["sermonId", "languageCode"], {
          unique: false,
        });
      }
      if (!db.objectStoreNames.contains(COMMENTS_STORE)) {
        const comments = db.createObjectStore(COMMENTS_STORE, { keyPath: "id" });
        comments.createIndex("by_sermon_and_language", ["sermonId", "languageCode"], {
          unique: false,
        });
        comments.createIndex(
          "by_sermon_and_paragraph_and_language",
          ["sermonId", "paragraphId", "languageCode"],
          { unique: false },
        );
      }
      if (!db.objectStoreNames.contains(TOOLBAR_PREFS_STORE)) {
        db.createObjectStore(TOOLBAR_PREFS_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB"));
  });
  return dbPromise;
}

function normalizeLanguageCode(languageCode: string) {
  const value = (languageCode || "nb").toLowerCase();
  if (value === "no" || value.startsWith("nb")) return "nb";
  return "en";
}

function listFromIndex<T>(
  store: IDBObjectStore,
  indexName: string,
  query: IDBValidKey | IDBKeyRange,
): Promise<T[]> {
  const index = store.index(indexName);
  const request = index.getAll(query);
  return requestToPromise(request);
}

function generateId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

export async function listPrivateHighlights(params: {
  sermonId: string;
  languageCode: string;
}): Promise<PrivateHighlight[]> {
  const db = await openDb();
  const tx = db.transaction(HIGHLIGHTS_STORE, "readonly");
  const store = tx.objectStore(HIGHLIGHTS_STORE);
  const rows = await listFromIndex<PrivateHighlight>(
    store,
    "by_sermon_and_language",
    [params.sermonId, normalizeLanguageCode(params.languageCode)],
  );
  await txDone(tx);
  return rows.sort((a, b) => a.updatedAt - b.updatedAt);
}

export async function upsertPrivateHighlight(
  input: Omit<PrivateHighlight, "id" | "updatedAt"> & { id?: string },
): Promise<PrivateHighlight> {
  const db = await openDb();
  const tx = db.transaction(HIGHLIGHTS_STORE, "readwrite");
  const store = tx.objectStore(HIGHLIGHTS_STORE);
  const record: PrivateHighlight = {
    ...input,
    id: input.id ?? generateId(),
    languageCode: normalizeLanguageCode(input.languageCode),
    updatedAt: Date.now(),
  };
  store.put(record);
  await txDone(tx);
  return record;
}

export async function deletePrivateHighlight(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(HIGHLIGHTS_STORE, "readwrite");
  tx.objectStore(HIGHLIGHTS_STORE).delete(id);
  await txDone(tx);
}

export async function getPrivateToolbarPrefs(params: {
  sermonId: string;
  languageCode: string;
}): Promise<PrivateToolbarPrefs | null> {
  const db = await openDb();
  const tx = db.transaction(TOOLBAR_PREFS_STORE, "readonly");
  const store = tx.objectStore(TOOLBAR_PREFS_STORE);
  const id = keyForToolbarPrefs(params.sermonId, normalizeLanguageCode(params.languageCode));
  const row = (await requestToPromise(store.get(id))) as (PrivateToolbarPrefs & { id: string }) | undefined;
  await txDone(tx);
  if (!row) return null;
  const { id: _id, ...prefs } = row;
  void _id;
  return prefs;
}

export async function setPrivateToolbarPrefs(
  input: Omit<PrivateToolbarPrefs, "updatedAt">,
): Promise<PrivateToolbarPrefs> {
  const db = await openDb();
  const tx = db.transaction(TOOLBAR_PREFS_STORE, "readwrite");
  const store = tx.objectStore(TOOLBAR_PREFS_STORE);
  const normalizedLanguage = normalizeLanguageCode(input.languageCode);
  const id = keyForToolbarPrefs(input.sermonId, normalizedLanguage);
  const record = {
    id,
    sermonId: input.sermonId,
    languageCode: normalizedLanguage,
    fontSizePx: input.fontSizePx,
    bookmarked: input.bookmarked,
    updatedAt: Date.now(),
  };
  store.put(record);
  await txDone(tx);
  return {
    sermonId: record.sermonId,
    languageCode: record.languageCode,
    fontSizePx: record.fontSizePx,
    bookmarked: record.bookmarked,
    updatedAt: record.updatedAt,
  };
}

export async function listPrivateComments(params: {
  sermonId: string;
  paragraphId: string;
  languageCode: string;
}): Promise<PrivateComment[]> {
  const db = await openDb();
  const tx = db.transaction(COMMENTS_STORE, "readonly");
  const store = tx.objectStore(COMMENTS_STORE);
  const rows = await listFromIndex<PrivateComment>(
    store,
    "by_sermon_and_paragraph_and_language",
    [params.sermonId, params.paragraphId, normalizeLanguageCode(params.languageCode)],
  );
  await txDone(tx);
  return rows.sort((a, b) => a.createdAt - b.createdAt);
}

export async function addPrivateComment(input: {
  sermonId: string;
  paragraphId: string;
  languageCode: string;
  body: string;
  parentId?: string | null;
  authorName?: string;
}): Promise<PrivateComment> {
  const db = await openDb();
  const tx = db.transaction(COMMENTS_STORE, "readwrite");
  const store = tx.objectStore(COMMENTS_STORE);
  const now = Date.now();
  const record: PrivateComment = {
    id: generateId(),
    sermonId: input.sermonId,
    paragraphId: input.paragraphId,
    languageCode: normalizeLanguageCode(input.languageCode),
    body: input.body,
    parentId: input.parentId ?? null,
    authorName: input.authorName ?? "You",
    createdAt: now,
    updatedAt: now,
  };
  store.put(record);
  await txDone(tx);
  return record;
}

export function highlightMergeKey(highlight: Pick<PrivateHighlight, "paragraphId" | "startOffset" | "endOffset">) {
  return `${highlight.paragraphId}:${highlight.startOffset}:${highlight.endOffset}`;
}

export function mergeHighlightsForImport(existing: PrivateHighlight[], incoming: PrivateHighlight[]) {
  const byKey = new Map<string, PrivateHighlight>();
  for (const item of existing) {
    byKey.set(highlightMergeKey(item), item);
  }
  for (const item of incoming) {
    const key = highlightMergeKey(item);
    const previous = byKey.get(key);
    byKey.set(key, {
      ...item,
      id: previous?.id ?? item.id ?? generateId(),
      updatedAt: Math.max(previous?.updatedAt ?? 0, item.updatedAt ?? Date.now()),
    });
  }
  return Array.from(byKey.values());
}

export function mergeCommentsForImport(existing: PrivateComment[], incoming: PrivateComment[]) {
  const byId = new Map<string, PrivateComment>();
  for (const item of existing) byId.set(item.id, item);
  for (const item of incoming) byId.set(item.id, item);
  return Array.from(byId.values());
}

export function parseAnnotationsImport(
  jsonText: string,
  context: { sermonId: string; languageCode: string },
): ReaderPrivateAnnotationsExportV1 {
  const parsed = JSON.parse(jsonText) as Partial<ReaderPrivateAnnotationsExportV1>;
  if (parsed.schemaVersion !== 1) {
    throw new Error("Unsupported annotation export version");
  }
  if (parsed.sermonId !== context.sermonId) {
    throw new Error("Annotation file belongs to another sermon");
  }
  const normalizedLanguage = normalizeLanguageCode(context.languageCode);
  if (normalizeLanguageCode(parsed.languageCode ?? "") !== normalizedLanguage) {
    throw new Error("Annotation file belongs to another language");
  }
  return {
    schemaVersion: 1,
    exportedAt: typeof parsed.exportedAt === "number" ? parsed.exportedAt : Date.now(),
    sermonId: parsed.sermonId,
    languageCode: normalizedLanguage,
    highlights: (parsed.highlights ?? []).map((h) => ({
      id: h.id ?? generateId(),
      sermonId: parsed.sermonId!,
      languageCode: normalizedLanguage,
      paragraphId: h.paragraphId!,
      color: h.color ?? "yellow",
      startOffset: h.startOffset ?? 0,
      endOffset: h.endOffset ?? 0,
      selectedText: h.selectedText ?? "",
      updatedAt: h.updatedAt ?? Date.now(),
    })),
    comments: (parsed.comments ?? []).map((c) => ({
      id: c.id ?? generateId(),
      sermonId: parsed.sermonId!,
      languageCode: normalizedLanguage,
      paragraphId: c.paragraphId!,
      body: c.body ?? "",
      parentId: c.parentId ?? null,
      authorName: c.authorName ?? "You",
      createdAt: c.createdAt ?? Date.now(),
      updatedAt: c.updatedAt ?? Date.now(),
    })),
    toolbarPrefs: parsed.toolbarPrefs
      ? {
          sermonId: parsed.sermonId!,
          languageCode: normalizedLanguage,
          fontSizePx: parsed.toolbarPrefs.fontSizePx ?? 16,
          bookmarked: Boolean(parsed.toolbarPrefs.bookmarked),
          updatedAt: parsed.toolbarPrefs.updatedAt ?? Date.now(),
        }
      : null,
  };
}

export async function exportPrivateAnnotations(params: {
  sermonId: string;
  languageCode: string;
}): Promise<ReaderPrivateAnnotationsExportV1> {
  const normalizedLanguage = normalizeLanguageCode(params.languageCode);
  const [highlights, toolbarPrefs] = await Promise.all([
    listPrivateHighlights({ sermonId: params.sermonId, languageCode: normalizedLanguage }),
    getPrivateToolbarPrefs({ sermonId: params.sermonId, languageCode: normalizedLanguage }),
  ]);

  const db = await openDb();
  const tx = db.transaction(COMMENTS_STORE, "readonly");
  const allComments = await listFromIndex<PrivateComment>(
    tx.objectStore(COMMENTS_STORE),
    "by_sermon_and_language",
    [params.sermonId, normalizedLanguage],
  );
  await txDone(tx);

  return {
    schemaVersion: 1,
    exportedAt: Date.now(),
    sermonId: params.sermonId,
    languageCode: normalizedLanguage,
    highlights,
    comments: allComments,
    toolbarPrefs,
  };
}

export async function importPrivateAnnotations(params: {
  sermonId: string;
  languageCode: string;
  jsonText: string;
  strategy?: "merge";
}) {
  const parsed = parseAnnotationsImport(params.jsonText, {
    sermonId: params.sermonId,
    languageCode: params.languageCode,
  });
  const strategy = params.strategy ?? "merge";
  if (strategy !== "merge") {
    throw new Error("Unsupported import strategy");
  }

  const normalizedLanguage = normalizeLanguageCode(params.languageCode);
  const existingHighlights = await listPrivateHighlights({
    sermonId: params.sermonId,
    languageCode: normalizedLanguage,
  });
  const existingCommentsByParagraph = await Promise.all(
    Array.from(new Set(parsed.comments.map((c) => c.paragraphId))).map((paragraphId) =>
      listPrivateComments({
        sermonId: params.sermonId,
        paragraphId,
        languageCode: normalizedLanguage,
      }),
    ),
  );
  const existingComments = existingCommentsByParagraph.flat();

  const mergedHighlights = mergeHighlightsForImport(existingHighlights, parsed.highlights);
  const mergedComments = mergeCommentsForImport(existingComments, parsed.comments);

  const db = await openDb();
  const tx = db.transaction([HIGHLIGHTS_STORE, COMMENTS_STORE, TOOLBAR_PREFS_STORE], "readwrite");
  const highlightsStore = tx.objectStore(HIGHLIGHTS_STORE);
  const commentsStore = tx.objectStore(COMMENTS_STORE);
  const toolbarStore = tx.objectStore(TOOLBAR_PREFS_STORE);

  for (const h of mergedHighlights) highlightsStore.put(h);
  for (const c of mergedComments) commentsStore.put(c);
  if (parsed.toolbarPrefs) {
    toolbarStore.put({
      id: keyForToolbarPrefs(params.sermonId, normalizedLanguage),
      ...parsed.toolbarPrefs,
    });
  }
  await txDone(tx);

  return {
    highlightsImported: parsed.highlights.length,
    commentsImported: parsed.comments.length,
    toolbarImported: Boolean(parsed.toolbarPrefs),
  };
}
