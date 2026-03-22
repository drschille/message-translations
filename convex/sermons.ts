import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {
    paginationOpts: v.any(),
    search: v.optional(v.string()),
    year: v.optional(v.string()),
    series: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let sermonsQuery = ctx.db.query("sermons").order("desc");

    // If we have a year or series filter, we might need to filter manually if we don't have indexes
    // For now, let's just use the basic query and filter the results if needed
    // In a production app, you'd add indexes for these fields.
    
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

      return { page: filtered, isDone: true, continueCursor: "" };
    }

    return await sermonsQuery.paginate(args.paginationOpts);
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
