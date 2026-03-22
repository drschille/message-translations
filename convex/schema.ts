import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  sermons: defineTable({
    title: v.string(),
    date: v.string(), // ISO format or "DD MMM YYYY"
    description: v.string(),
    scripture: v.optional(v.string()),
    audioUrl: v.optional(v.string()),
    pdfUrl: v.optional(v.string()),
    transcript: v.optional(v.string()),
    series: v.optional(v.string()),
  }).index("by_date", ["date"]),
});
