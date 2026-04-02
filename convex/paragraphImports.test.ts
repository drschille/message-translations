/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function createSermon(t: ReturnType<typeof convexTest>, tag: string) {
  await t.action(api.sermons.importFromBranham, {
    sermons: [
      {
        title: `Sermon ${tag}`,
        date: "1965-01-01",
        tag,
        location: "Test",
      },
    ],
  });

  const sermons = await t.query(api.sermons.list, {
    paginationOpts: { cursor: null, numItems: 20 },
    languageCode: "nb",
    search: tag,
  });

  const sermon = sermons.page.find((row) => row.tag === tag);
  expect(sermon?._id).toBeDefined();
  return sermon!._id;
}

function makeParagraphs(seed: Array<[number, string, string]>) {
  return seed.map(([paragraphID, text, textNo]) => ({
    paragraphID,
    text,
    text_no: textNo,
  }));
}

async function addHeavyArtifacts(
  t: ReturnType<typeof convexTest>,
  sermonId: string,
  paragraphIds: string[],
) {
  for (const paragraphId of paragraphIds) {
    for (let i = 0; i < 12; i += 1) {
      await t.mutation(api.editorial.addComment, {
        paragraphId: paragraphId as any,
        languageCode: "nb",
        body: `Comment ${i} for ${paragraphId}`,
      });
    }
    for (let i = 0; i < 10; i += 1) {
      await t.mutation(api.editorial.updateParagraphDraft, {
        paragraphId: paragraphId as any,
        languageCode: "nb",
        translatedText: `Draft ${i} for ${paragraphId}`,
      });
    }
  }

  await t.mutation(api.editorial.setSermonProofreadingState, {
    sermonId: sermonId as any,
    state: "done",
  });
  await t.mutation(api.editorial.publishSermonVersion, {
    sermonId: sermonId as any,
    languageCode: "nb",
  });
}

describe("paragraph imports", () => {
  test("imports paragraphs into source and translation tables for a new sermon", async () => {
    const t = convexTest(schema, modules);
    const sermonId = await createSermon(t, "65-TEST-IMPORT-1");

    const result = await t.action(api.paragraphImports.importSermonParagraphs, {
      imports: [
        {
          sermonTag: "65-TEST-IMPORT-1",
          languageCode: "nb",
          paragraphs: makeParagraphs([
            [10, "Original one", "Oversatt en"],
            [20, "Original two", "Oversatt to"],
          ]),
        },
      ],
    });

    expect(result.errors).toBe(0);
    expect(result.inserted).toBe(2);
    expect(result.results[0].skipped).toBe(false);

    const paragraphs = await t.query(api.editorial.listParagraphs, {
      sermonId,
      languageCode: "nb",
      paginationOpts: { cursor: null, numItems: 20 },
    });

    expect(paragraphs.page).toHaveLength(2);
    expect(paragraphs.page[0].sourceText).toBe("Original one");
    expect(paragraphs.page[0].translatedText).toBe("Oversatt en");
    expect(paragraphs.page[0].status).toBe("approved");
    expect(paragraphs.page[1].sourceText).toBe("Original two");
    expect(paragraphs.page[1].translatedText).toBe("Oversatt to");
  });

  test("skips sermon by default when paragraphs already exist", async () => {
    const t = convexTest(schema, modules);
    await createSermon(t, "65-TEST-IMPORT-2");

    await t.action(api.paragraphImports.importSermonParagraphs, {
      imports: [
        {
          sermonTag: "65-TEST-IMPORT-2",
          paragraphs: makeParagraphs([[1, "A", "B"]]),
        },
      ],
    });

    const second = await t.action(api.paragraphImports.importSermonParagraphs, {
      imports: [
        {
          sermonTag: "65-TEST-IMPORT-2",
          paragraphs: makeParagraphs([[1, "Updated A", "Updated B"]]),
        },
      ],
    });

    expect(second.errors).toBe(0);
    expect(second.skipped).toBe(1);
    expect(second.results[0].skipped).toBe(true);
    expect(second.results[0].inserted).toBe(0);
    expect(second.results[0].updated).toBe(0);
  });

  test("overwrite mode updates existing, inserts missing, and prunes extra paragraphs", async () => {
    const t = convexTest(schema, modules);
    const sermonId = await createSermon(t, "65-TEST-IMPORT-3");

    await t.action(api.paragraphImports.importSermonParagraphs, {
      imports: [
        {
          sermonTag: "65-TEST-IMPORT-3",
          paragraphs: makeParagraphs([
            [1, "Old 1", "Gammel 1"],
            [2, "Old 2", "Gammel 2"],
            [3, "Old 3", "Gammel 3"],
          ]),
        },
      ],
    });

    const overwrite = await t.action(api.paragraphImports.importSermonParagraphs, {
      imports: [
        {
          sermonTag: "65-TEST-IMPORT-3",
          overwriteExisting: true,
          paragraphs: makeParagraphs([
            [1, "New 1", "Ny 1"],
            [2, "New 2", "Ny 2"],
          ]),
        },
      ],
    });

    expect(overwrite.errors).toBe(0);
    expect(overwrite.results[0].updated).toBe(2);
    expect(overwrite.results[0].deleted).toBe(1);

    const paragraphs = await t.query(api.editorial.listParagraphs, {
      sermonId,
      languageCode: "nb",
      paginationOpts: { cursor: null, numItems: 20 },
    });

    expect(paragraphs.page).toHaveLength(2);
    expect(paragraphs.page[0].sourceText).toBe("New 1");
    expect(paragraphs.page[0].translatedText).toBe("Ny 1");
    expect(paragraphs.page[1].sourceText).toBe("New 2");
    expect(paragraphs.page[1].translatedText).toBe("Ny 2");
  });

  test("clean mode fully replaces paragraphs and clears published versions", async () => {
    const t = convexTest(schema, modules);
    const sermonId = await createSermon(t, "65-TEST-IMPORT-4");

    await t.action(api.paragraphImports.importSermonParagraphs, {
      imports: [
        {
          sermonTag: "65-TEST-IMPORT-4",
          paragraphs: makeParagraphs([
            [1, "Seed 1", "Frø 1"],
            [2, "Seed 2", "Frø 2"],
          ]),
        },
      ],
    });

    await t.mutation(api.editorial.setSermonProofreadingState, {
      sermonId,
      state: "done",
    });
    await t.mutation(api.editorial.publishSermonVersion, {
      sermonId,
      languageCode: "nb",
    });

    const beforeVersions = await t.query(api.editorial.listPublishedVersions, {
      sermonId,
      paginationOpts: { cursor: null, numItems: 10 },
    });
    expect(beforeVersions.page.length).toBeGreaterThan(0);

    const clean = await t.action(api.paragraphImports.importSermonParagraphs, {
      imports: [
        {
          sermonTag: "65-TEST-IMPORT-4",
          cleanExisting: true,
          paragraphs: makeParagraphs([[1, "Replaced 1", "Erstattet 1"]]),
        },
      ],
    });

    expect(clean.errors).toBe(0);
    expect(clean.results[0].deleted).toBe(2);
    expect(clean.results[0].inserted).toBe(1);

    const afterVersions = await t.query(api.editorial.listPublishedVersions, {
      sermonId,
      paginationOpts: { cursor: null, numItems: 10 },
    });
    expect(afterVersions.page).toHaveLength(0);

    const sermon = await t.query(api.sermons.getById, {
      id: sermonId,
      languageCode: "nb",
    });
    expect(sermon?.isPublished ?? false).toBe(false);
    expect(sermon?.currentVersion ?? 0).toBe(0);
  });

  test("returns structured error for unknown sermon tag", async () => {
    const t = convexTest(schema, modules);

    const result = await t.action(api.paragraphImports.importSermonParagraphs, {
      imports: [
        {
          sermonTag: "65-UNKNOWN",
          paragraphs: makeParagraphs([[1, "A", "B"]]),
        },
      ],
    });

    expect(result.errors).toBe(1);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].error).toContain("Sermon not found");
  });

  test("returns structured row-level error when text_no is empty", async () => {
    const t = convexTest(schema, modules);
    const sermonId = await createSermon(t, "65-TEST-IMPORT-5");

    const result = await t.action(api.paragraphImports.importSermonParagraphs, {
      imports: [
        {
          sermonTag: "65-TEST-IMPORT-5",
          paragraphs: makeParagraphs([
            [1, "Valid source", ""],
            [2, "Another source", "Gyldig oversettelse"],
          ]),
        },
      ],
    });

    expect(result.errors).toBe(1);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].error).toContain("index 0");
    expect(result.results[0].error).toContain("text_no");

    const paragraphs = await t.query(api.editorial.listParagraphs, {
      sermonId,
      languageCode: "nb",
      paginationOpts: { cursor: null, numItems: 20 },
    });
    expect(paragraphs.page).toHaveLength(0);
  });

  test("cleanExisting succeeds with heavier paragraph subtree data", async () => {
    const t = convexTest(schema, modules);
    const sermonId = await createSermon(t, "65-TEST-IMPORT-HEAVY-CLEAN");

    await t.action(api.paragraphImports.importSermonParagraphs, {
      imports: [
        {
          sermonTag: "65-TEST-IMPORT-HEAVY-CLEAN",
          paragraphs: makeParagraphs([
            [1, "Seed 1", "Frø 1"],
            [2, "Seed 2", "Frø 2"],
            [3, "Seed 3", "Frø 3"],
            [4, "Seed 4", "Frø 4"],
          ]),
        },
      ],
    });

    const before = await t.query(api.editorial.listParagraphs, {
      sermonId,
      languageCode: "nb",
      paginationOpts: { cursor: null, numItems: 50 },
    });
    const oldParagraphIds = before.page.map((row) => row._id as string);
    await addHeavyArtifacts(t, sermonId as unknown as string, oldParagraphIds);

    const clean = await t.action(api.paragraphImports.importSermonParagraphs, {
      imports: [
        {
          sermonTag: "65-TEST-IMPORT-HEAVY-CLEAN",
          cleanExisting: true,
          paragraphs: makeParagraphs([
            [1, "Replaced 1", "Erstattet 1"],
            [2, "Replaced 2", "Erstattet 2"],
          ]),
        },
      ],
    });

    expect(clean.errors).toBe(0);
    expect(clean.results[0].skipped).toBe(false);
    expect(clean.results[0].inserted).toBe(2);
    expect(clean.results[0].deleted).toBeGreaterThanOrEqual(4);

    const after = await t.query(api.editorial.listParagraphs, {
      sermonId,
      languageCode: "nb",
      paginationOpts: { cursor: null, numItems: 50 },
    });
    expect(after.page).toHaveLength(2);
    expect(after.page[0].sourceText).toBe("Replaced 1");
    expect(after.page[1].sourceText).toBe("Replaced 2");

    const versions = await t.query(api.editorial.listPublishedVersions, {
      sermonId,
      paginationOpts: { cursor: null, numItems: 20 },
    });
    expect(versions.page).toHaveLength(0);
  });

  test("overwriteExisting prunes extra paragraphs through bounded cleanup", async () => {
    const t = convexTest(schema, modules);
    const sermonId = await createSermon(t, "65-TEST-IMPORT-HEAVY-OVERWRITE");

    await t.action(api.paragraphImports.importSermonParagraphs, {
      imports: [
        {
          sermonTag: "65-TEST-IMPORT-HEAVY-OVERWRITE",
          paragraphs: makeParagraphs([
            [1, "Old 1", "Gammel 1"],
            [2, "Old 2", "Gammel 2"],
            [3, "Old 3", "Gammel 3"],
            [4, "Old 4", "Gammel 4"],
            [5, "Old 5", "Gammel 5"],
          ]),
        },
      ],
    });

    const before = await t.query(api.editorial.listParagraphs, {
      sermonId,
      languageCode: "nb",
      paginationOpts: { cursor: null, numItems: 50 },
    });
    const extraIds = before.page.slice(2).map((row) => row._id as string);
    await addHeavyArtifacts(t, sermonId as unknown as string, extraIds);

    const overwrite = await t.action(api.paragraphImports.importSermonParagraphs, {
      imports: [
        {
          sermonTag: "65-TEST-IMPORT-HEAVY-OVERWRITE",
          overwriteExisting: true,
          paragraphs: makeParagraphs([
            [1, "New 1", "Ny 1"],
            [2, "New 2", "Ny 2"],
          ]),
        },
      ],
    });

    expect(overwrite.errors).toBe(0);
    expect(overwrite.results[0].updated).toBe(2);
    expect(overwrite.results[0].deleted).toBe(3);

    const after = await t.query(api.editorial.listParagraphs, {
      sermonId,
      languageCode: "nb",
      paginationOpts: { cursor: null, numItems: 50 },
    });
    expect(after.page).toHaveLength(2);
    expect(after.page[0].sourceText).toBe("New 1");
    expect(after.page[1].sourceText).toBe("New 2");
  });
});
