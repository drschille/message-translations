/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function setupApprovedParagraph(t: ReturnType<typeof convexTest>) {
  await t.mutation(api.sermons.seed, {});
  const sermons = await t.query(api.sermons.list, {
    paginationOpts: { cursor: null, numItems: 20 },
    languageCode: "nb",
  });
  const sermonId = sermons.page[0]?._id;
  expect(sermonId).toBeDefined();

  await t.mutation(api.editorial.ensureParagraphsForSermon, {
    sermonId,
    languageCode: "nb",
  });

  const paragraphs = await t.query(api.editorial.listParagraphs, {
    sermonId,
    languageCode: "nb",
    paginationOpts: { cursor: null, numItems: 100 },
  });

  const approvedParagraph = paragraphs.page.find((p) => p.status === "approved");
  expect(approvedParagraph).toBeDefined();

  return {
    sermonId,
    paragraphId: approvedParagraph!._id,
  };
}

async function setupUnapprovedParagraph(t: ReturnType<typeof convexTest>) {
  await t.mutation(api.sermons.seed, {});
  const sermons = await t.query(api.sermons.list, {
    paginationOpts: { cursor: null, numItems: 20 },
    languageCode: "nb",
  });
  const sermonId = sermons.page[0]?._id;
  expect(sermonId).toBeDefined();

  await t.mutation(api.editorial.ensureParagraphsForSermon, {
    sermonId,
    languageCode: "nb",
  });

  const paragraphs = await t.query(api.editorial.listParagraphs, {
    sermonId,
    languageCode: "nb",
    paginationOpts: { cursor: null, numItems: 100 },
  });

  const unapprovedParagraph = paragraphs.page.find((p) => p.status !== "approved");
  expect(unapprovedParagraph).toBeDefined();

  return {
    sermonId,
    paragraphId: unapprovedParagraph!._id,
    initialTranslatedText: unapprovedParagraph!.translatedText,
  };
}

describe("editorial revert to last approved", () => {
  test("reverts edited text back to original approved translation", async () => {
    const t = convexTest(schema, modules);
    const { sermonId, paragraphId } = await setupApprovedParagraph(t);

    const revisionsBefore = await t.query(api.editorial.listRevisions, {
      paragraphId,
      languageCode: "nb",
      paginationOpts: { cursor: null, numItems: 50 },
    });
    const originalApproved = revisionsBefore.page.find((r) => r.status === "approved");
    expect(originalApproved).toBeDefined();

    await t.mutation(api.editorial.updateParagraphDraft, {
      paragraphId,
      languageCode: "nb",
      translatedText: "Dette er en redigert tekst som skal forkastes.",
      submitForReview: false,
    });

    const revertResult = await t.mutation(api.editorial.revertParagraphToLastApproved as any, {
      paragraphId,
      languageCode: "nb",
    });
    expect(revertResult.ok).toBe(true);
    expect(revertResult.translatedText).toBe(originalApproved!.snapshotText);

    const paragraphsAfter = await t.query(api.editorial.listParagraphs, {
      sermonId,
      languageCode: "nb",
      paginationOpts: { cursor: null, numItems: 100 },
    });
    const paragraphAfter = paragraphsAfter.page.find((p) => p._id === paragraphId);
    expect(paragraphAfter?.translatedText).toBe(originalApproved!.snapshotText);
    expect(paragraphAfter?.status).toBe("drafting");
  });

  test("reverts to the latest approved translation, not the initial one", async () => {
    const t = convexTest(schema, modules);
    const { sermonId, paragraphId } = await setupApprovedParagraph(t);

    await t.mutation(api.editorial.updateParagraphDraft, {
      paragraphId,
      languageCode: "nb",
      translatedText: "Ny godkjent oversettelse v2",
      submitForReview: true,
    });
    await t.mutation(api.editorial.updateParagraphStatus, {
      paragraphId,
      languageCode: "nb",
      status: "approved",
      reason: "Approve new translation",
    });

    await t.mutation(api.editorial.updateParagraphDraft, {
      paragraphId,
      languageCode: "nb",
      translatedText: "Midlertidig utkast som skal reverteres",
      submitForReview: false,
    });

    const revertResult = await t.mutation(api.editorial.revertParagraphToLastApproved as any, {
      paragraphId,
      languageCode: "nb",
    });
    expect(revertResult.ok).toBe(true);
    expect(revertResult.translatedText).toBe("Ny godkjent oversettelse v2");

    const paragraphsAfter = await t.query(api.editorial.listParagraphs, {
      sermonId,
      languageCode: "nb",
      paginationOpts: { cursor: null, numItems: 100 },
    });
    const paragraphAfter = paragraphsAfter.page.find((p) => p._id === paragraphId);
    expect(paragraphAfter?.translatedText).toBe("Ny godkjent oversettelse v2");
  });

  test("falls back to initial translation when no approved revision exists", async () => {
    const t = convexTest(schema, modules);
    const { sermonId, paragraphId, initialTranslatedText } = await setupUnapprovedParagraph(t);

    await t.mutation(api.editorial.updateParagraphDraft, {
      paragraphId,
      languageCode: "nb",
      translatedText: "Midlertidig endring som skal forkastes",
      submitForReview: false,
    });

    const revertResult = await t.mutation(api.editorial.revertParagraphToLastApproved as any, {
      paragraphId,
      languageCode: "nb",
    });
    expect(revertResult.ok).toBe(true);
    expect(revertResult.translatedText).toBe(initialTranslatedText);

    const paragraphsAfter = await t.query(api.editorial.listParagraphs, {
      sermonId,
      languageCode: "nb",
      paginationOpts: { cursor: null, numItems: 100 },
    });
    const paragraphAfter = paragraphsAfter.page.find((p) => p._id === paragraphId);
    expect(paragraphAfter?.translatedText).toBe(initialTranslatedText);
  });

  test("listRevertBaselines returns approved target when approved exists", async () => {
    const t = convexTest(schema, modules);
    const { sermonId, paragraphId } = await setupApprovedParagraph(t);

    await t.mutation(api.editorial.updateParagraphDraft, {
      paragraphId,
      languageCode: "nb",
      translatedText: "Ny godkjent baseline",
      submitForReview: true,
    });
    await t.mutation(api.editorial.updateParagraphStatus, {
      paragraphId,
      languageCode: "nb",
      status: "approved",
      reason: "Approve baseline for revert query test",
    });

    const baselines = await t.query(api.editorial.listRevertBaselines as any, {
      sermonId,
      languageCode: "nb",
    });
    const row = baselines.find((b: any) => b.paragraphId === paragraphId);
    expect(row?.targetText).toBe("Ny godkjent baseline");
  });

  test("listRevertBaselines falls back to initial snapshot when no approved exists", async () => {
    const t = convexTest(schema, modules);
    const { sermonId, paragraphId, initialTranslatedText } = await setupUnapprovedParagraph(t);

    const baselines = await t.query(api.editorial.listRevertBaselines as any, {
      sermonId,
      languageCode: "nb",
    });
    const row = baselines.find((b: any) => b.paragraphId === paragraphId);
    expect(row?.targetText).toBe(initialTranslatedText);
  });
});
