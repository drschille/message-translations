import { describe, expect, test } from "vitest";
import {
  mergeCommentsForImport,
  mergeHighlightsForImport,
  parseAnnotationsImport,
  type PrivateComment,
  type PrivateHighlight,
} from "./readerPrivateAnnotations";

function highlight(partial: Partial<PrivateHighlight>): PrivateHighlight {
  return {
    id: partial.id ?? "h-1",
    sermonId: partial.sermonId ?? "sermon-1",
    languageCode: partial.languageCode ?? "nb",
    paragraphId: partial.paragraphId ?? "p-1",
    color: partial.color ?? "yellow",
    startOffset: partial.startOffset ?? 0,
    endOffset: partial.endOffset ?? 5,
    selectedText: partial.selectedText ?? "hello",
    updatedAt: partial.updatedAt ?? 1,
  };
}

function comment(partial: Partial<PrivateComment>): PrivateComment {
  return {
    id: partial.id ?? "c-1",
    sermonId: partial.sermonId ?? "sermon-1",
    languageCode: partial.languageCode ?? "nb",
    paragraphId: partial.paragraphId ?? "p-1",
    body: partial.body ?? "note",
    parentId: partial.parentId ?? null,
    authorName: partial.authorName ?? "You",
    createdAt: partial.createdAt ?? 1,
    updatedAt: partial.updatedAt ?? 1,
  };
}

describe("readerPrivateAnnotations merge", () => {
  test("mergeHighlightsForImport merges by paragraph and range and imported wins", () => {
    const existing = [highlight({ id: "old", color: "yellow", startOffset: 0, endOffset: 4 })];
    const incoming = [highlight({ id: "new", color: "blue", startOffset: 0, endOffset: 4, updatedAt: 99 })];

    const merged = mergeHighlightsForImport(existing, incoming);

    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe("old");
    expect(merged[0].color).toBe("blue");
    expect(merged[0].updatedAt).toBe(99);
  });

  test("mergeCommentsForImport merges by id and imported wins", () => {
    const existing = [comment({ id: "c-1", body: "old body" })];
    const incoming = [comment({ id: "c-1", body: "new body" }), comment({ id: "c-2", body: "another" })];

    const merged = mergeCommentsForImport(existing, incoming);
    const byId = new Map(merged.map((c) => [c.id, c]));

    expect(merged).toHaveLength(2);
    expect(byId.get("c-1")?.body).toBe("new body");
    expect(byId.get("c-2")?.body).toBe("another");
  });
});

describe("parseAnnotationsImport", () => {
  test("parses and normalizes valid payload", () => {
    const parsed = parseAnnotationsImport(
      JSON.stringify({
        schemaVersion: 1,
        sermonId: "sermon-1",
        languageCode: "no",
        highlights: [{ paragraphId: "p-1", startOffset: 1, endOffset: 3, selectedText: "ok", color: "green" }],
        comments: [{ id: "x", paragraphId: "p-1", body: "A" }],
      }),
      { sermonId: "sermon-1", languageCode: "nb" },
    );

    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.languageCode).toBe("nb");
    expect(parsed.highlights).toHaveLength(1);
    expect(parsed.comments).toHaveLength(1);
  });

  test("rejects mismatched sermon", () => {
    expect(() =>
      parseAnnotationsImport(
        JSON.stringify({ schemaVersion: 1, sermonId: "sermon-2", languageCode: "nb", highlights: [], comments: [] }),
        { sermonId: "sermon-1", languageCode: "nb" },
      ),
    ).toThrow("another sermon");
  });
});
