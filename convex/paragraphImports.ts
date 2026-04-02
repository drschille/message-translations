import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { action, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

const paragraphStatus = "approved" as const;
const MAX_DELETES_PER_CLEANUP_CHUNK = 250;
const MAX_CLEANUP_ITERATIONS = 20000;

const paragraphRowValidator = v.object({
  paragraphID: v.number(),
  text: v.string(),
  text_no: v.string(),
});

const importRequestValidator = v.object({
  sermonTag: v.string(),
  paragraphs: v.array(paragraphRowValidator),
  languageCode: v.optional(v.string()),
  cleanExisting: v.optional(v.boolean()),
  overwriteExisting: v.optional(v.boolean()),
});

function normalizeLanguageCode(languageCode: string | undefined) {
  return languageCode?.trim().toLowerCase() || "nb";
}

function normalizeAndValidateParagraphRows(
  rows: Array<{
    paragraphID: number;
    text: string;
    text_no: string;
  }>,
  sermonTag: string,
) {
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const sourceText = row.text.trim();
    const translatedText = row.text_no.trim();
    if (sourceText.length === 0) {
      throw new Error(
        `Invalid paragraph row at index ${index} for sermon '${sermonTag}': text must be non-empty`,
      );
    }
    if (translatedText.length === 0) {
      throw new Error(
        `Invalid paragraph row at index ${index} for sermon '${sermonTag}': text_no must be non-empty`,
      );
    }
  }

  return [...rows]
    .sort((a, b) => a.paragraphID - b.paragraphID)
    .map((row, index) => ({
      order: index + 1,
      sourceText: row.text.trim(),
      translatedText: row.text_no.trim(),
    }));
}

async function upsertTranslationForLanguage(
  ctx: MutationCtx,
  paragraphId: Id<"sermonParagraphs">,
  languageCode: string,
  translatedText: string,
  now: number,
) {
  const existing = await ctx.db
    .query("sermonParagraphTranslations")
    .withIndex("by_paragraphId_and_languageCode", (q) =>
      q.eq("paragraphId", paragraphId).eq("languageCode", languageCode),
    )
    .unique();

  if (existing) {
    await ctx.db.patch(existing._id, {
      translatedText,
      status: paragraphStatus,
      updatedAt: now,
    });

    await ctx.db.insert("paragraphTranslationRevisions", {
      paragraphTranslationId: existing._id,
      snapshotText: translatedText,
      status: paragraphStatus,
      kind: "edit",
      reason: "Imported paragraph update",
      authorName: "System import",
      createdAt: now,
    });
    return;
  }

  const translationId = await ctx.db.insert("sermonParagraphTranslations", {
    paragraphId,
    languageCode,
    translatedText,
    status: paragraphStatus,
    updatedAt: now,
  });

  await ctx.db.insert("paragraphTranslationRevisions", {
    paragraphTranslationId: translationId,
    snapshotText: translatedText,
    status: paragraphStatus,
    kind: "edit",
    reason: "Imported paragraph seed",
    authorName: "System import",
    createdAt: now,
  });
}

async function resolveSermonIdByTag(ctx: MutationCtx, sermonTag: string) {
  const tag = sermonTag.trim();
  if (!tag) {
    throw new Error("sermonTag is required");
  }
  const matches = await ctx.db
    .query("sermons")
    .withIndex("by_tag", (q) => q.eq("tag", tag))
    .take(2);
  if (matches.length === 0) {
    throw new Error(`Sermon not found for tag '${tag}'`);
  }
  if (matches.length > 1) {
    throw new Error(`Multiple sermons found for tag '${tag}'`);
  }
  return matches[0]._id;
}

async function deleteRowsInBatch<Row extends { _id: string }>(
  ctx: MutationCtx,
  rows: Row[],
  limit: number,
  deletedCount: { value: number },
) {
  const toDelete = rows.slice(0, limit);
  for (const row of toDelete) {
    await ctx.db.delete(row._id as any);
  }
  deletedCount.value += toDelete.length;
  return toDelete.length;
}

async function cleanupParagraphSubtreeChunkInTx(
  ctx: MutationCtx,
  paragraphId: Id<"sermonParagraphs">,
  maxDeletes: number,
) {
  const paragraph = await ctx.db.get(paragraphId);
  if (!paragraph) {
    return { done: true, paragraphDeleted: false, deletedDocs: 0 };
  }
  const deletedCount = { value: 0 };
  const remaining = () => Math.max(0, maxDeletes - deletedCount.value);

  const paragraphComments = await ctx.db
    .query("paragraphComments")
    .withIndex("by_paragraphId_and_createdAt", (q) => q.eq("paragraphId", paragraphId))
    .take(remaining());
  await deleteRowsInBatch(ctx, paragraphComments, remaining(), deletedCount);

  if (remaining() > 0) {
    const paragraphRevisions = await ctx.db
      .query("paragraphRevisions")
      .withIndex("by_paragraphId_and_createdAt", (q) => q.eq("paragraphId", paragraphId))
      .take(remaining());
    await deleteRowsInBatch(ctx, paragraphRevisions, remaining(), deletedCount);
  }

  if (remaining() > 0) {
    const highlights = await ctx.db
      .query("paragraphSelectionHighlights")
      .withIndex("by_paragraphId", (q) => q.eq("paragraphId", paragraphId))
      .take(remaining());
    await deleteRowsInBatch(ctx, highlights, remaining(), deletedCount);
  }

  if (remaining() > 0) {
    const snapshots = await ctx.db
      .query("sermonPublishedParagraphSnapshots")
      .withIndex("by_paragraphId", (q) => q.eq("paragraphId", paragraphId))
      .take(remaining());
    await deleteRowsInBatch(ctx, snapshots, remaining(), deletedCount);
  }

  if (remaining() > 0) {
    const translations = await ctx.db
      .query("sermonParagraphTranslations")
      .withIndex("by_paragraphId_and_languageCode", (q) => q.eq("paragraphId", paragraphId))
      .take(Math.max(1, Math.min(remaining(), 100)));

    for (const translation of translations) {
      if (remaining() <= 0) break;
      const translationComments = await ctx.db
        .query("paragraphTranslationComments")
        .withIndex("by_paragraphTranslationId_and_createdAt", (q) =>
          q.eq("paragraphTranslationId", translation._id),
        )
        .take(remaining());
      await deleteRowsInBatch(ctx, translationComments, remaining(), deletedCount);

      if (remaining() <= 0) break;
      const translationRevisions = await ctx.db
        .query("paragraphTranslationRevisions")
        .withIndex("by_paragraphTranslationId_and_createdAt", (q) =>
          q.eq("paragraphTranslationId", translation._id),
        )
        .take(remaining());
      await deleteRowsInBatch(ctx, translationRevisions, remaining(), deletedCount);

      if (remaining() <= 0) break;
      const hasComments = (
        await ctx.db
          .query("paragraphTranslationComments")
          .withIndex("by_paragraphTranslationId_and_createdAt", (q) =>
            q.eq("paragraphTranslationId", translation._id),
          )
          .take(1)
      ).length > 0;
      const hasRevisions = (
        await ctx.db
          .query("paragraphTranslationRevisions")
          .withIndex("by_paragraphTranslationId_and_createdAt", (q) =>
            q.eq("paragraphTranslationId", translation._id),
          )
          .take(1)
      ).length > 0;
      if (!hasComments && !hasRevisions) {
        await ctx.db.delete(translation._id);
        deletedCount.value += 1;
      }
    }
  }

  if (remaining() <= 0) {
    return { done: false, paragraphDeleted: false, deletedDocs: deletedCount.value };
  }

  const hasParagraphComments = (
    await ctx.db
      .query("paragraphComments")
      .withIndex("by_paragraphId_and_createdAt", (q) => q.eq("paragraphId", paragraphId))
      .take(1)
  ).length > 0;
  const hasParagraphRevisions = (
    await ctx.db
      .query("paragraphRevisions")
      .withIndex("by_paragraphId_and_createdAt", (q) => q.eq("paragraphId", paragraphId))
      .take(1)
  ).length > 0;
  const hasHighlights = (
    await ctx.db
      .query("paragraphSelectionHighlights")
      .withIndex("by_paragraphId", (q) => q.eq("paragraphId", paragraphId))
      .take(1)
  ).length > 0;
  const hasSnapshots = (
    await ctx.db
      .query("sermonPublishedParagraphSnapshots")
      .withIndex("by_paragraphId", (q) => q.eq("paragraphId", paragraphId))
      .take(1)
  ).length > 0;
  const hasTranslations = (
    await ctx.db
      .query("sermonParagraphTranslations")
      .withIndex("by_paragraphId_and_languageCode", (q) => q.eq("paragraphId", paragraphId))
      .take(1)
  ).length > 0;

  if (!hasParagraphComments && !hasParagraphRevisions && !hasHighlights && !hasSnapshots && !hasTranslations) {
    await ctx.db.delete(paragraphId);
    deletedCount.value += 1;
    return { done: true, paragraphDeleted: true, deletedDocs: deletedCount.value };
  }

  return { done: false, paragraphDeleted: false, deletedDocs: deletedCount.value };
}

export const cleanupParagraphSubtreeChunk = internalMutation({
  args: {
    paragraphId: v.id("sermonParagraphs"),
    maxDeletes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const maxDeletes = Math.max(1, Math.min(args.maxDeletes ?? MAX_DELETES_PER_CLEANUP_CHUNK, 1000));
    return await cleanupParagraphSubtreeChunkInTx(ctx, args.paragraphId, maxDeletes);
  },
});

export const cleanupSermonParagraphsChunk = internalMutation({
  args: {
    sermonTag: v.string(),
    maxDeletes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const sermonId = await resolveSermonIdByTag(ctx, args.sermonTag);
    const firstParagraph = await ctx.db
      .query("sermonParagraphs")
      .withIndex("by_sermonId_and_order", (q) => q.eq("sermonId", sermonId))
      .take(1);
    if (firstParagraph.length === 0) {
      return {
        done: true,
        deletedParagraphs: 0,
        deletedDocs: 0,
      };
    }

    const maxDeletes = Math.max(1, Math.min(args.maxDeletes ?? MAX_DELETES_PER_CLEANUP_CHUNK, 1000));
    const result = await cleanupParagraphSubtreeChunkInTx(ctx, firstParagraph[0]._id, maxDeletes);
    const hasRemainingParagraphs = (
      await ctx.db
        .query("sermonParagraphs")
        .withIndex("by_sermonId_and_order", (q) => q.eq("sermonId", sermonId))
        .take(1)
    ).length > 0;
    return {
      done: !hasRemainingParagraphs,
      deletedParagraphs: result.paragraphDeleted ? 1 : 0,
      deletedDocs: result.deletedDocs,
    };
  },
});

export const clearPublishedVersionsForSermonChunk = internalMutation({
  args: {
    sermonTag: v.string(),
    maxDeletes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const sermonId = await resolveSermonIdByTag(ctx, args.sermonTag);
    const maxDeletes = Math.max(1, Math.min(args.maxDeletes ?? MAX_DELETES_PER_CLEANUP_CHUNK, 1000));
    const deletedCount = { value: 0 };
    const remaining = () => Math.max(0, maxDeletes - deletedCount.value);

    const versions = await ctx.db
      .query("sermonPublishedVersions")
      .withIndex("by_sermonId_and_version", (q) => q.eq("sermonId", sermonId))
      .take(1);
    if (versions.length === 0) {
      await ctx.db.patch(sermonId, {
        isPublished: false,
        currentVersion: 0,
      });
      return {
        done: true,
        deletedVersions: 0,
        deletedDocs: 0,
      };
    }

    const version = versions[0];
    const snapshots = await ctx.db
      .query("sermonPublishedParagraphSnapshots")
      .withIndex("by_publishedVersionId_and_order", (q) => q.eq("publishedVersionId", version._id))
      .take(remaining());
    await deleteRowsInBatch(ctx, snapshots, remaining(), deletedCount);

    if (remaining() > 0) {
      const hasSnapshots = (
        await ctx.db
          .query("sermonPublishedParagraphSnapshots")
          .withIndex("by_publishedVersionId_and_order", (q) => q.eq("publishedVersionId", version._id))
          .take(1)
      ).length > 0;
      if (!hasSnapshots) {
        await ctx.db.delete(version._id);
        deletedCount.value += 1;
      }
    }

    return {
      done: false,
      deletedVersions: deletedCount.value > snapshots.length ? 1 : 0,
      deletedDocs: deletedCount.value,
    };
  },
});

export const listParagraphIdsBySermonTag = internalQuery({
  args: {
    sermonTag: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const tag = args.sermonTag.trim();
    if (!tag) {
      throw new Error("sermonTag is required");
    }
    const sermonMatches = await ctx.db
      .query("sermons")
      .withIndex("by_tag", (q) => q.eq("tag", tag))
      .take(2);
    if (sermonMatches.length === 0) {
      throw new Error(`Sermon not found for tag '${tag}'`);
    }
    if (sermonMatches.length > 1) {
      throw new Error(`Multiple sermons found for tag '${tag}'`);
    }
    const sermonId = sermonMatches[0]._id;
    const page = await ctx.db
      .query("sermonParagraphs")
      .withIndex("by_sermonId_and_order", (q) => q.eq("sermonId", sermonId))
      .paginate(args.paginationOpts);

    return {
      ...page,
      page: page.page.map((row) => row._id),
    };
  },
});

async function insertAllParagraphs(
  ctx: MutationCtx,
  sermonId: Id<"sermons">,
  languageCode: string,
  rows: Array<{ order: number; sourceText: string; translatedText: string }>,
  now: number,
) {
  let inserted = 0;
  for (const row of rows) {
    const paragraphId = await ctx.db.insert("sermonParagraphs", {
      sermonId,
      order: row.order,
      sourceText: row.sourceText,
      updatedAt: now,
    });
    await upsertTranslationForLanguage(ctx, paragraphId, languageCode, row.translatedText, now);
    inserted += 1;
  }
  return inserted;
}

export const importSermonParagraphs = action({
  args: {
    imports: v.array(importRequestValidator),
  },
  handler: async (ctx, args) => {
    const results: Array<{
      sermonTag: string;
      languageCode: string;
      inserted: number;
      updated: number;
      deleted: number;
      skipped: boolean;
      error: string | null;
    }> = [];

    let inserted = 0;
    let updated = 0;
    let deleted = 0;
    let skipped = 0;
    let errors = 0;

    for (const request of args.imports) {
      const languageCode = normalizeLanguageCode(request.languageCode);
      const cleanExisting = request.cleanExisting ?? false;
      const overwriteExisting = request.overwriteExisting ?? false;

      if (cleanExisting && overwriteExisting) {
        errors += 1;
        results.push({
          sermonTag: request.sermonTag,
          languageCode,
          inserted: 0,
          updated: 0,
          deleted: 0,
          skipped: false,
          error: "cleanExisting and overwriteExisting cannot both be true",
        });
        continue;
      }

      let mutationResult: {
        sermonTag: string;
        languageCode: string;
        inserted: number;
        updated: number;
        deleted: number;
        skipped: boolean;
      };

      try {
        const cleanupDeletes = { paragraphs: 0 };
        if (cleanExisting) {
          let iterations = 0;
          while (true) {
            iterations += 1;
            if (iterations > MAX_CLEANUP_ITERATIONS) {
              throw new Error(`Cleanup exceeded ${MAX_CLEANUP_ITERATIONS} iterations for '${request.sermonTag}'`);
            }
            const cleanupResult: {
              done: boolean;
              deletedParagraphs: number;
            } = await ctx.runMutation(internal.paragraphImports.cleanupSermonParagraphsChunk, {
              sermonTag: request.sermonTag,
              maxDeletes: MAX_DELETES_PER_CLEANUP_CHUNK,
            });
            cleanupDeletes.paragraphs += cleanupResult.deletedParagraphs;
            if (cleanupResult.done) {
              break;
            }
          }

          iterations = 0;
          while (true) {
            iterations += 1;
            if (iterations > MAX_CLEANUP_ITERATIONS) {
              throw new Error(
                `Published-version cleanup exceeded ${MAX_CLEANUP_ITERATIONS} iterations for '${request.sermonTag}'`,
              );
            }
            const versionCleanupResult: { done: boolean } = await ctx.runMutation(
              internal.paragraphImports.clearPublishedVersionsForSermonChunk,
              {
                sermonTag: request.sermonTag,
                maxDeletes: MAX_DELETES_PER_CLEANUP_CHUNK,
              },
            );
            if (versionCleanupResult.done) {
              break;
            }
          }
        }

        mutationResult = await ctx.runMutation(
          internal.paragraphImports.importSermonParagraphsInternal,
          {
            sermonTag: request.sermonTag,
            languageCode,
            paragraphs: request.paragraphs,
            cleanExisting: false,
            overwriteExisting,
          },
        );

        if (overwriteExisting) {
          const keepCount = request.paragraphs.length;
          const extraParagraphIds: Id<"sermonParagraphs">[] = [];
          let cursor: string | null = null;
          let seen = 0;
          while (true) {
            const page: {
              page: Id<"sermonParagraphs">[];
              continueCursor: string;
              isDone: boolean;
            } = await ctx.runQuery(internal.paragraphImports.listParagraphIdsBySermonTag, {
              sermonTag: request.sermonTag,
              paginationOpts: { cursor, numItems: 200 },
            });
            for (const paragraphId of page.page) {
              if (seen >= keepCount) {
                extraParagraphIds.push(paragraphId);
              }
              seen += 1;
            }
            if (page.isDone) {
              break;
            }
            cursor = page.continueCursor;
          }

          for (const paragraphId of extraParagraphIds) {
            let iterations = 0;
            while (true) {
              iterations += 1;
              if (iterations > MAX_CLEANUP_ITERATIONS) {
                throw new Error(
                  `Paragraph cleanup exceeded ${MAX_CLEANUP_ITERATIONS} iterations for '${request.sermonTag}'`,
                );
              }
              const cleanupResult: {
                done: boolean;
                paragraphDeleted: boolean;
              } = await ctx.runMutation(internal.paragraphImports.cleanupParagraphSubtreeChunk, {
                paragraphId,
                maxDeletes: MAX_DELETES_PER_CLEANUP_CHUNK,
              });
              if (cleanupResult.done) {
                if (cleanupResult.paragraphDeleted) {
                  cleanupDeletes.paragraphs += 1;
                }
                break;
              }
            }
          }
        }

        mutationResult.deleted += cleanupDeletes.paragraphs;
      } catch (error) {
        errors += 1;
        results.push({
          sermonTag: request.sermonTag,
          languageCode,
          inserted: 0,
          updated: 0,
          deleted: 0,
          skipped: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        continue;
      }

      inserted += mutationResult.inserted;
      updated += mutationResult.updated;
      deleted += mutationResult.deleted;
      skipped += mutationResult.skipped ? 1 : 0;

      results.push({
        ...mutationResult,
        error: null,
      });
    }

    return {
      received: args.imports.length,
      inserted,
      updated,
      deleted,
      skipped,
      errors,
      results,
    };
  },
});

export const importSermonParagraphsInternal = internalMutation({
  args: {
    sermonTag: v.string(),
    languageCode: v.string(),
    paragraphs: v.array(paragraphRowValidator),
    cleanExisting: v.boolean(),
    overwriteExisting: v.boolean(),
  },
  handler: async (ctx, args) => {
    const tag = args.sermonTag.trim();
    if (!tag) {
      throw new Error("sermonTag is required");
    }

    const normalizedRows = normalizeAndValidateParagraphRows(args.paragraphs, tag);
    if (normalizedRows.length === 0) {
      throw new Error(`No valid paragraph rows for sermon tag '${tag}'`);
    }

    const sermonId = await resolveSermonIdByTag(ctx, tag);
    const now = Date.now();

    const existingParagraphs: Array<{
      _id: Id<"sermonParagraphs">;
      order: number;
    }> = [];
    for await (const paragraph of ctx.db
      .query("sermonParagraphs")
      .withIndex("by_sermonId_and_order", (q) => q.eq("sermonId", sermonId))) {
      existingParagraphs.push({
        _id: paragraph._id,
        order: paragraph.order,
      });
    }

    const hasExisting = existingParagraphs.length > 0;

    if (!args.cleanExisting && !args.overwriteExisting && hasExisting) {
      return {
        sermonTag: tag,
        languageCode: args.languageCode,
        inserted: 0,
        updated: 0,
        deleted: 0,
        skipped: true,
      };
    }

    let inserted = 0;
    let updated = 0;
    let deleted = 0;

    if (args.overwriteExisting && hasExisting) {
      for (let i = 0; i < normalizedRows.length; i += 1) {
        const row = normalizedRows[i];
        const existing = existingParagraphs[i];
        if (existing) {
          await ctx.db.patch(existing._id, {
            order: row.order,
            sourceText: row.sourceText,
            updatedAt: now,
          });
          await upsertTranslationForLanguage(
            ctx,
            existing._id,
            args.languageCode,
            row.translatedText,
            now,
          );
          updated += 1;
        } else {
          const paragraphId = await ctx.db.insert("sermonParagraphs", {
            sermonId,
            order: row.order,
            sourceText: row.sourceText,
            updatedAt: now,
          });
          await upsertTranslationForLanguage(
            ctx,
            paragraphId,
            args.languageCode,
            row.translatedText,
            now,
          );
          inserted += 1;
        }
      }

      return {
        sermonTag: tag,
        languageCode: args.languageCode,
        inserted,
        updated,
        deleted,
        skipped: false,
      };
    }

    inserted += await insertAllParagraphs(
      ctx,
      sermonId,
      args.languageCode,
      normalizedRows,
      now,
    );

    return {
      sermonTag: tag,
      languageCode: args.languageCode,
      inserted,
      updated,
      deleted,
      skipped: false,
    };
  },
});
