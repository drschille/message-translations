import { beforeAll, describe, expect, it } from "vitest";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";

const deploymentUrl = process.env.CONVEX_TEST_URL;
const describeIfConvex = deploymentUrl ? describe : describe.skip;

describeIfConvex("backend integration (real Convex)", () => {
  let client: ConvexHttpClient;
  let documentId: string;
  let segmentId: string;

  beforeAll(async () => {
    client = new ConvexHttpClient(deploymentUrl!);
    await client.mutation(api.admin.bootstrapDefault, {});
    await client.mutation(api.sermons.seed, {});
    await client.mutation(api.documents.syncLegacySermons, { locale: "nb" });

    const docs = await client.query(api.documents.list, {
      useCase: "sermon",
      paginationOpts: { cursor: null, numItems: 10 },
    });
    expect(docs.page.length).toBeGreaterThan(0);
    documentId = String(docs.page[0]._id);

    const segments = await client.query(api.documents.listSegments, {
      documentId: docs.page[0]._id,
      locale: "nb",
      paginationOpts: { cursor: null, numItems: 10 },
    });
    expect(segments.page.length).toBeGreaterThan(0);
    segmentId = String(segments.page[0]._id);
  });

  it("saves translation and creates version history", async () => {
    const save = await client.mutation(api.translations.saveSegmentTranslation, {
      segmentId: segmentId as any,
      locale: "nb",
      text: "Integration test translation update.",
      reason: "integration-test",
      submitForReview: true,
    });

    expect(save.translationId).toBeTruthy();
    expect(save.versionId).toBeTruthy();

    const versions = await client.query(api.history.listTranslationVersions, {
      segmentId: segmentId as any,
      locale: "nb",
      paginationOpts: { cursor: null, numItems: 20 },
    });
    expect(versions.page.length).toBeGreaterThan(0);
    expect(versions.page[0].kind).toMatch(/edit|restore|import/);
  });

  it("creates and resolves a comment thread", async () => {
    const created = await client.mutation(api.comments.add, {
      segmentId: segmentId as any,
      locale: "nb",
      body: "Please verify terminology.",
    });
    expect(created.commentId).toBeTruthy();

    const resolved = await client.mutation(api.comments.setResolved, {
      commentId: created.commentId,
      resolved: true,
    });
    expect(resolved.ok).toBe(true);

    const comments = await client.query(api.comments.listBySegment, {
      segmentId: segmentId as any,
      locale: "nb",
      paginationOpts: { cursor: null, numItems: 20 },
    });
    expect(comments.page.some((c) => String(c._id) === String(created.commentId))).toBe(true);
  });

  it("produces activity timeline entries for document operations", async () => {
    const history = await client.query(api.history.listActivityByDocument, {
      documentId: documentId as any,
      paginationOpts: { cursor: null, numItems: 50 },
    });
    expect(history.page.length).toBeGreaterThan(0);
    const actions = history.page.map((row) => row.action);
    expect(actions.some((action) => action.includes("translation") || action.includes("comment"))).toBe(true);
  });
});
