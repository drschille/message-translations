import { v } from "convex/values";
import { action, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

const paragraphStatus = "approved" as const;

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

async function deleteParagraphSubtree(ctx: MutationCtx, paragraphId: Id<"sermonParagraphs">) {
  while (true) {
    const translationComments = await ctx.db
      .query("paragraphComments")
      .withIndex("by_paragraphId_and_createdAt", (q) => q.eq("paragraphId", paragraphId))
      .take(500);
    if (translationComments.length === 0) break;
    for (const comment of translationComments) {
      await ctx.db.delete(comment._id);
    }
  }

  while (true) {
    const paragraphRevisions = await ctx.db
      .query("paragraphRevisions")
      .withIndex("by_paragraphId_and_createdAt", (q) => q.eq("paragraphId", paragraphId))
      .take(500);
    if (paragraphRevisions.length === 0) break;
    for (const revision of paragraphRevisions) {
      await ctx.db.delete(revision._id);
    }
  }

  while (true) {
    const highlights = await ctx.db
      .query("paragraphSelectionHighlights")
      .withIndex("by_paragraphId", (q) => q.eq("paragraphId", paragraphId))
      .take(500);
    if (highlights.length === 0) break;
    for (const highlight of highlights) {
      await ctx.db.delete(highlight._id);
    }
  }

  while (true) {
    const snapshots = await ctx.db
      .query("sermonPublishedParagraphSnapshots")
      .withIndex("by_paragraphId", (q) => q.eq("paragraphId", paragraphId))
      .take(500);
    if (snapshots.length === 0) break;
    for (const snapshot of snapshots) {
      await ctx.db.delete(snapshot._id);
    }
  }

  while (true) {
    const translations = await ctx.db
      .query("sermonParagraphTranslations")
      .withIndex("by_paragraphId_and_languageCode", (q) => q.eq("paragraphId", paragraphId))
      .take(500);
    if (translations.length === 0) break;

    for (const translation of translations) {
      while (true) {
        const comments = await ctx.db
          .query("paragraphTranslationComments")
          .withIndex("by_paragraphTranslationId_and_createdAt", (q) =>
            q.eq("paragraphTranslationId", translation._id),
          )
          .take(500);
        if (comments.length === 0) break;
        for (const comment of comments) {
          await ctx.db.delete(comment._id);
        }
      }

      while (true) {
        const revisions = await ctx.db
          .query("paragraphTranslationRevisions")
          .withIndex("by_paragraphTranslationId_and_createdAt", (q) =>
            q.eq("paragraphTranslationId", translation._id),
          )
          .take(500);
        if (revisions.length === 0) break;
        for (const revision of revisions) {
          await ctx.db.delete(revision._id);
        }
      }

      await ctx.db.delete(translation._id);
    }
  }
}

async function clearPublishedVersionsForSermon(ctx: MutationCtx, sermonId: Id<"sermons">) {
  while (true) {
    const versions = await ctx.db
      .query("sermonPublishedVersions")
      .withIndex("by_sermonId_and_version", (q) => q.eq("sermonId", sermonId))
      .take(200);
    if (versions.length === 0) break;

    for (const version of versions) {
      while (true) {
        const snapshots = await ctx.db
          .query("sermonPublishedParagraphSnapshots")
          .withIndex("by_publishedVersionId_and_order", (q) =>
            q.eq("publishedVersionId", version._id),
          )
          .take(500);
        if (snapshots.length === 0) break;
        for (const snapshot of snapshots) {
          await ctx.db.delete(snapshot._id);
        }
      }
      await ctx.db.delete(version._id);
    }
  }

  await ctx.db.patch(sermonId, {
    isPublished: false,
    currentVersion: 0,
  });
}

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
        mutationResult = await ctx.runMutation(
          internal.paragraphImports.importSermonParagraphsInternal,
          {
            sermonTag: request.sermonTag,
            languageCode,
            paragraphs: request.paragraphs,
            cleanExisting,
            overwriteExisting,
          },
        );
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

    if (args.cleanExisting && hasExisting) {
      for (const paragraph of existingParagraphs) {
        await deleteParagraphSubtree(ctx, paragraph._id);
        await ctx.db.delete(paragraph._id);
      }
      deleted += existingParagraphs.length;
      await clearPublishedVersionsForSermon(ctx, sermonId);
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
    }

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

      for (let i = normalizedRows.length; i < existingParagraphs.length; i += 1) {
        const extra = existingParagraphs[i];
        await deleteParagraphSubtree(ctx, extra._id);
        await ctx.db.delete(extra._id);
        deleted += 1;
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
