import { action, internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

const sermonTranslationValidator = v.object({
  languageCode: v.string(),
  title: v.optional(v.string()),
  description: v.optional(v.string()),
});

const branhamSermonValidator = v.object({
  sid: v.optional(v.number()),
  title: v.string(),
  description: v.optional(v.string()),
  title_no: v.optional(v.string()),
  description_no: v.optional(v.string()),
  date: v.string(),
  location: v.optional(v.string()),
  tag: v.string(),
  translations: v.optional(v.array(sermonTranslationValidator)),
});

const SERMONS_TOTAL_KEY = "sermons_total";

function normalizeLanguageCode(languageCode: string) {
  return languageCode.trim().toLowerCase() || "nb";
}

async function getStoredSermonCount(ctx: QueryCtx) {
  const metric = await ctx.db
    .query("appMetrics")
    .withIndex("by_key", (q) => q.eq("key", SERMONS_TOTAL_KEY))
    .unique();
  return metric?.value;
}

async function ensureSermonCountMetric(ctx: MutationCtx) {
  const existing = await ctx.db
    .query("appMetrics")
    .withIndex("by_key", (q) => q.eq("key", SERMONS_TOTAL_KEY))
    .unique();

  if (existing) return existing;

  const total = (await ctx.db.query("sermons").collect()).length;
  const metricId = await ctx.db.insert("appMetrics", {
    key: SERMONS_TOTAL_KEY,
    value: total,
    updatedAt: Date.now(),
  });
  const created = await ctx.db.get(metricId);
  if (!created) {
    throw new Error("Failed to initialize sermons total metric");
  }
  return created;
}

async function bumpSermonCount(ctx: MutationCtx, delta: number) {
  const metric = await ensureSermonCountMetric(ctx);
  if (delta === 0) return;
  await ctx.db.patch(metric._id, {
    value: metric.value + delta,
    updatedAt: Date.now(),
  });
}

async function resolveLocalizedMetadata(
  ctx: QueryCtx,
  sermon: Doc<"sermons">,
  languageCode: string,
) {
  const normalized = normalizeLanguageCode(languageCode);

  const localized = await ctx.db
    .query("sermonMetadataTranslations")
    .withIndex("by_sermonId_and_languageCode", (q) =>
      q.eq("sermonId", sermon._id).eq("languageCode", normalized),
    )
    .unique();

  return {
    ...sermon,
    title: localized?.title ?? sermon.title,
    description: localized?.description ?? sermon.description,
  };
}

export const getById = query({
  args: {
    id: v.id("sermons"),
    languageCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const sermon = await ctx.db.get(args.id);
    if (!sermon) return null;
    return await resolveLocalizedMetadata(ctx, sermon, args.languageCode ?? "nb");
  },
});

export const list = query({
  args: {
    paginationOpts: paginationOptsValidator,
    search: v.optional(v.string()),
    year: v.optional(v.string()),
    series: v.optional(v.string()),
    languageCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const languageCode = args.languageCode ?? "nb";
    const hasFilters = Boolean(args.search || args.year || args.series);
    const all = await ctx.db.query("sermons").order("desc").collect();

    const localized = await Promise.all(
      all.map((sermon) => resolveLocalizedMetadata(ctx, sermon, languageCode)),
    );

    let filtered = localized;

    if (args.search) {
      const search = args.search.toLowerCase();
      filtered = filtered.filter((s) =>
        s.title.toLowerCase().includes(search) ||
        s.description.toLowerCase().includes(search) ||
        (s.scripture && s.scripture.toLowerCase().includes(search)),
      );
    }

    if (args.year) {
      filtered = filtered.filter((s) => s.date.startsWith(args.year!));
    }

    if (args.series) {
      filtered = filtered.filter((s) => s.series === args.series);
    }

    const start = args.paginationOpts.cursor ? Number(args.paginationOpts.cursor) : 0;
    const numItems = args.paginationOpts.numItems;
    const page = filtered.slice(start, start + numItems);
    const next = start + page.length;
    const isDone = next >= filtered.length;
    const storedCount = await getStoredSermonCount(ctx);
    const totalCount = !hasFilters && typeof storedCount === "number"
      ? storedCount
      : filtered.length;

    return {
      page,
      isDone,
      continueCursor: isDone ? "" : String(next),
      totalCount,
    };
  },
});

function extractYearFromDate(date: string) {
  const trimmed = date.trim();
  if (/^\d{4}/.test(trimmed)) {
    return trimmed.slice(0, 4);
  }

  const match = trimmed.match(/\b(\d{4})\b/);
  return match?.[1] ?? null;
}

export const listYears = query({
  args: {},
  handler: async (ctx) => {
    const years = new Set<string>();
    for await (const sermon of ctx.db.query("sermons").withIndex("by_date")) {
      const year = extractYearFromDate(sermon.date);
      if (year) {
        years.add(year);
      }
    }

    return Array.from(years).sort((a, b) => b.localeCompare(a));
  },
});

export const importFromBranham = action({
  args: {
    sermons: v.array(branhamSermonValidator),
  },
  handler: async (ctx, args) => {
    for (let i = 0; i < args.sermons.length; i += 1) {
      const sermon = args.sermons[i];

      if (sermon.title_no || sermon.description_no) {
        throw new Error(
          `Legacy translation fields (title_no/description_no) are not supported (item index ${i}). Use 'translations: [{ languageCode, title?, description? }]' instead.`,
        );
      }

      for (let j = 0; j < (sermon.translations ?? []).length; j += 1) {
        const translation = sermon.translations![j];
        const languageCode = normalizeLanguageCode(translation.languageCode);
        const hasTitle = Boolean(translation.title?.trim());
        const hasDescription = Boolean(translation.description?.trim());

        if (!languageCode) {
          throw new Error(
            `Translation languageCode is required (item index ${i}, translation index ${j}).`,
          );
        }
        if (!hasTitle && !hasDescription) {
          throw new Error(
            `Translation must include at least one of title or description (item index ${i}, translation index ${j}).`,
          );
        }
      }
    }

    const chunkSize = 200;
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let translationsInserted = 0;
    let translationsUpdated = 0;
    let translationsSkipped = 0;

    for (let i = 0; i < args.sermons.length; i += chunkSize) {
      const chunk = args.sermons.slice(i, i + chunkSize);
      const batchResult: {
        inserted: number;
        updated: number;
        skipped: number;
        translationsInserted: number;
        translationsUpdated: number;
        translationsSkipped: number;
      } = await ctx.runMutation(internal.sermons.importFromBranhamBatch, {
        sermons: chunk,
      });

      inserted += batchResult.inserted;
      updated += batchResult.updated;
      skipped += batchResult.skipped;
      translationsInserted += batchResult.translationsInserted;
      translationsUpdated += batchResult.translationsUpdated;
      translationsSkipped += batchResult.translationsSkipped;
    }

    return {
      received: args.sermons.length,
      inserted,
      updated,
      skipped,
      translationsInserted,
      translationsUpdated,
      translationsSkipped,
      errors: 0,
    };
  },
});

export const importFromBranhamBatch = internalMutation({
  args: {
    sermons: v.array(branhamSermonValidator),
  },
  handler: async (ctx, args) => {
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let translationsInserted = 0;
    let translationsUpdated = 0;
    let translationsSkipped = 0;

    for (const sermon of args.sermons) {
      const title = sermon.title.trim();
      const description = sermon.description?.trim() ?? "";
      const date = sermon.date.trim();
      const tag = sermon.tag.trim();
      const location = sermon.location?.trim() || undefined;

      if (!title || !date || !tag) {
        skipped += 1;
        continue;
      }

      const matches = await ctx.db
        .query("sermons")
        .withIndex("by_tag", (q) => q.eq("tag", tag))
        .take(2);

      let sermonId: Id<"sermons">;

      if (matches.length > 1) {
        skipped += 1;
        continue;
      }

      if (matches.length === 1) {
        sermonId = matches[0]._id;
        await ctx.db.patch(sermonId, {
          title,
          date,
          description,
          tag,
          location,
        });
        updated += 1;
      } else {
        sermonId = await ctx.db.insert("sermons", {
          title,
          date,
          description,
          tag,
          location,
        });
        inserted += 1;
      }

      for (const translation of sermon.translations ?? []) {
        const languageCode = normalizeLanguageCode(translation.languageCode);
        const localizedTitle = translation.title?.trim() || undefined;
        const localizedDescription = translation.description?.trim() || undefined;

        if (!localizedTitle && !localizedDescription) {
          translationsSkipped += 1;
          continue;
        }

        const existing = await ctx.db
          .query("sermonMetadataTranslations")
          .withIndex("by_sermonId_and_languageCode", (q) =>
            q.eq("sermonId", sermonId).eq("languageCode", languageCode),
          )
          .unique();

        if (existing) {
          await ctx.db.patch(existing._id, {
            ...(localizedTitle ? { title: localizedTitle } : {}),
            ...(localizedDescription ? { description: localizedDescription } : {}),
            updatedAt: Date.now(),
          });
          translationsUpdated += 1;
        } else {
          await ctx.db.insert("sermonMetadataTranslations", {
            sermonId,
            languageCode,
            title: localizedTitle ?? title,
            description: localizedDescription ?? description,
            updatedAt: Date.now(),
          });
          translationsInserted += 1;
        }
      }
    }

    await bumpSermonCount(ctx, inserted);

    return {
      inserted,
      updated,
      skipped,
      translationsInserted,
      translationsUpdated,
      translationsSkipped,
    };
  },
});

export const backfillMetadataTranslationsNb = mutation({
  args: {},
  handler: async (ctx) => {
    const sermons = await ctx.db.query("sermons").collect();
    let created = 0;
    let existing = 0;

    for (const sermon of sermons) {
      const translation = await ctx.db
        .query("sermonMetadataTranslations")
        .withIndex("by_sermonId_and_languageCode", (q) =>
          q.eq("sermonId", sermon._id).eq("languageCode", "nb"),
        )
        .unique();

      if (translation) {
        existing += 1;
        continue;
      }

      await ctx.db.insert("sermonMetadataTranslations", {
        sermonId: sermon._id,
        languageCode: "nb",
        title: sermon.title,
        description: sermon.description,
        updatedAt: Date.now(),
      });
      created += 1;
    }

    return { created, existing };
  },
});

export const backfillSermonCount = mutation({
  args: {},
  handler: async (ctx) => {
    const metric = await ensureSermonCountMetric(ctx);
    const total = (await ctx.db.query("sermons").collect()).length;
    await ctx.db.patch(metric._id, {
      value: total,
      updatedAt: Date.now(),
    });
    return { total };
  },
});

// Seed data mutation
export const seed = mutation({
  handler: async (ctx) => {
    const existing = await ctx.db.query("sermons").collect();
    if (existing.length > 0) {
      await ensureSermonCountMetric(ctx);
      return;
    }

    const sermons = [
      {
        title: "The First Seal",
        date: "1963-04-01",
        description: "The first sermon of the Seven Seals series. Revelation 6:1-2 is opened as the Lamb breaks the first seal, revealing the rider on the white horse.",
        scripture: "Revelation 6:1-2",
        series: "The Seven Seals",
      },
      {
        title: "Questions And Answers On The Seals",
        date: "1963-03-24",
        description: "A comprehensive session answering believers' questions regarding the revelation of the Seven Seals.",
        scripture: "Various",
        series: "The Seven Seals",
      },
      {
        title: "The Sixth Seal",
        date: "1963-03-23",
        description: "The opening of the Sixth Seal, revealing the cosmic disturbances and the judgment of the earth.",
        scripture: "Revelation 6:12-17",
        series: "The Seven Seals",
      },
      {
        title: "The Fifth Seal",
        date: "1963-03-22",
        description: "The souls under the altar and the white robes given to them during the opening of the Fifth Seal.",
        scripture: "Revelation 6:9-11",
        series: "The Seven Seals",
      },
      {
        title: "The Fourth Seal",
        date: "1963-03-21",
        description: "The pale horse and its rider, Death, followed by Hell, during the opening of the Fourth Seal.",
        scripture: "Revelation 6:7-8",
        series: "The Seven Seals",
      },
      {
        title: "The Third Seal",
        date: "1963-03-20",
        description: "The black horse and the rider with the balances, signifying famine and economic judgment.",
        scripture: "Revelation 6:5-6",
        series: "The Seven Seals",
      },
    ];

    for (const sermon of sermons) {
      await ctx.db.insert("sermons", sermon);
    }

    await bumpSermonCount(ctx, sermons.length);
  },
});
