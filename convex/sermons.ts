import { action, internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { internal } from "./_generated/api";

const branhamSermonValidator = v.object({
  sid: v.optional(v.number()),
  title: v.string(),
  title_no: v.optional(v.string()),
  date: v.string(),
  location: v.optional(v.string()),
  tag: v.string(),
});

export const getById = query({
  args: { id: v.id("sermons") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const list = query({
  args: {
    paginationOpts: paginationOptsValidator,
    search: v.optional(v.string()),
    year: v.optional(v.string()),
    series: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let sermonsQuery = ctx.db.query("sermons").order("desc");

    if (args.search || args.year || args.series) {
      const all = await sermonsQuery.collect();
      let filtered = all;

      if (args.search) {
        const query = args.search.toLowerCase();
        filtered = filtered.filter(s => 
          s.title.toLowerCase().includes(query) ||
          s.description.toLowerCase().includes(query) ||
          (s.scripture && s.scripture.toLowerCase().includes(query))
        );
      }

      if (args.year) {
        filtered = filtered.filter(s => s.date.startsWith(args.year!));
      }

      if (args.series) {
        filtered = filtered.filter(s => s.series === args.series);
      }

      // Manual pagination for filtered results
      const numItems = args.paginationOpts.numItems;
      const page = filtered.slice(0, numItems);
      const isDone = filtered.length <= numItems;

      return { 
        page, 
        isDone, 
        continueCursor: isDone ? "" : "manual_cursor" 
      };
    }

    return await sermonsQuery.paginate(args.paginationOpts);
  },
});

export const importFromBranham = action({
  args: {
    sermons: v.array(branhamSermonValidator),
  },
  handler: async (ctx, args) => {
    const chunkSize = 200;
    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (let i = 0; i < args.sermons.length; i += chunkSize) {
      const chunk = args.sermons.slice(i, i + chunkSize);
      const batchResult: {
        inserted: number;
        updated: number;
        skipped: number;
      } = await ctx.runMutation(internal.sermons.importFromBranhamBatch, {
        sermons: chunk,
      });

      inserted += batchResult.inserted;
      updated += batchResult.updated;
      skipped += batchResult.skipped;
    }

    return {
      received: args.sermons.length,
      inserted,
      updated,
      skipped,
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

    for (const sermon of args.sermons) {
      const title = sermon.title.trim();
      const date = sermon.date.trim();
      const tag = sermon.tag.trim();

      if (!title || !date || !tag) {
        skipped += 1;
        continue;
      }

      const matches = await ctx.db
        .query("sermons")
        .withIndex("by_tag", (q) => q.eq("tag", tag))
        .take(2);

      if (matches.length > 1) {
        skipped += 1;
        continue;
      }

      if (matches.length === 1) {
        await ctx.db.patch(matches[0]._id, {
          title,
          date,
          description: "",
          tag,
        });
        updated += 1;
      } else {
        await ctx.db.insert("sermons", {
          title,
          date,
          description: "",
          tag,
        });
        inserted += 1;
      }
    }

    return { inserted, updated, skipped };
  },
});

// Seed data mutation
export const seed = mutation({
  handler: async (ctx) => {
    const existing = await ctx.db.query("sermons").collect();
    if (existing.length > 0) return;

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
      }
    ];

    for (const s of sermons) {
      await ctx.db.insert("sermons", s);
    }
  },
});
