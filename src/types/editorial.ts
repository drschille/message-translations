import type { Doc, Id } from "@/convex/_generated/dataModel";

export type ParagraphStatus = "draft" | "drafting" | "needs_review" | "approved";

export type Paragraph = Doc<"sermonParagraphs">;
export type ParagraphComment = Doc<"paragraphComments">;
export type ParagraphRevision = Doc<"paragraphRevisions">;

export type ParagraphId = Id<"sermonParagraphs">;
export type SermonId = Id<"sermons">;
