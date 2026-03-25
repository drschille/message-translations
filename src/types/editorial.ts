export type ParagraphStatus = "draft" | "drafting" | "needs_review" | "approved" | "blocked";

export type DocumentId = string;
export type SegmentId = string;
export type CommentId = string;
export type VersionId = string;

export type ParagraphId = SegmentId;
export type SermonId = DocumentId;

export interface ParagraphComment {
  _id: CommentId;
  parentCommentId?: CommentId;
  body: string;
  authorUserId?: string;
  createdAt: number;
  status?: "open" | "resolved";
}

export interface ParagraphRevision {
  _id: VersionId;
  text?: string;
  snapshotText?: string;
  status: ParagraphStatus;
  kind: "edit" | "restore" | "import";
  reason?: string;
  createdAt: number;
}
