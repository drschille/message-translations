/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function seedAndGetFirstSermonId(t: ReturnType<typeof convexTest>) {
  await t.mutation(api.sermons.seed, {});
  const sermons = await t.query(api.sermons.list, {
    paginationOpts: { cursor: null, numItems: 20 },
    languageCode: "nb",
  });
  const sermonId = sermons.page[0]?._id;
  expect(sermonId).toBeDefined();
  return sermonId!;
}

describe("sermons list totalCount with filters", () => {
  test("uses filtered totalCount when only proofreadingState filter is applied", async () => {
    const t = convexTest(schema, modules);
    const sermonId = await seedAndGetFirstSermonId(t);

    await t.mutation(api.editorial.setSermonProofreadingState, {
      sermonId,
      state: "in_progress",
    });

    const result = await t.query(api.sermons.list, {
      paginationOpts: { cursor: null, numItems: 1 },
      languageCode: "nb",
      proofreadingState: "in_progress",
    });

    expect(result.page).toHaveLength(1);
    expect(result.totalCount).toBe(1);
    expect(result.isDone).toBe(true);
  });

  test("uses filtered totalCount when only isPublished filter is applied", async () => {
    const t = convexTest(schema, modules);
    const sermonId = await seedAndGetFirstSermonId(t);

    await t.mutation(api.editorial.ensureParagraphsForSermon, {
      sermonId,
      languageCode: "nb",
    });
    await t.mutation(api.editorial.setSermonProofreadingState, {
      sermonId,
      state: "done",
    });
    await t.mutation(api.editorial.publishSermonVersion, {
      sermonId,
      languageCode: "nb",
    });

    const result = await t.query(api.sermons.list, {
      paginationOpts: { cursor: null, numItems: 1 },
      languageCode: "nb",
      isPublished: true,
    });

    expect(result.page).toHaveLength(1);
    expect(result.totalCount).toBe(1);
    expect(result.isDone).toBe(true);
  });
});
