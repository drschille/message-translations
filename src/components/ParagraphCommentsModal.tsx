import { useMemo, useState } from "react";
import { MessageSquare, Reply, Send, X } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { ParagraphComment, ParagraphId } from "@/src/types/editorial";

interface ParagraphCommentsModalProps {
  paragraphId: ParagraphId | null;
  open: boolean;
  onClose: () => void;
}

function formatRelativeTime(timestamp: number): string {
  const deltaMs = Date.now() - timestamp;
  const minutes = Math.floor(deltaMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function ParagraphCommentsModal({ paragraphId, open, onClose }: ParagraphCommentsModalProps) {
  const commentsResult = useQuery(
    api.editorial.listComments,
    paragraphId ? { paragraphId, paginationOpts: { cursor: null, numItems: 200 } } : "skip",
  );
  const addComment = useMutation(api.editorial.addComment);
  const [draftComment, setDraftComment] = useState("");
  const [replyParentId, setReplyParentId] = useState<Id<"paragraphComments"> | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const comments = useMemo(() => commentsResult?.page ?? [], [commentsResult]);
  const rootComments = useMemo(
    () => comments.filter((comment) => !comment.parentCommentId),
    [comments],
  );
  const repliesByParent = useMemo(() => {
    const grouped: Record<string, ParagraphComment[]> = {};
    for (const comment of comments) {
      if (!comment.parentCommentId) continue;
      const key = String(comment.parentCommentId);
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(comment);
    }
    return grouped;
  }, [comments]);

  if (!open || !paragraphId) {
    return null;
  }

  const submitComment = async () => {
    const body = draftComment.trim();
    if (!body) return;
    setSubmitting(true);
    try {
      await addComment({
        paragraphId,
        body,
        parentCommentId: replyParentId ?? undefined,
      });
      setDraftComment("");
      setReplyParentId(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md md:p-8">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-outline/25 bg-surface-container shadow-2xl">
        <div className="flex items-center justify-between border-b border-outline/20 bg-surface-container-low px-6 py-5">
          <div>
            <h3 className="font-headline text-2xl text-on-surface">Paragraph Comments</h3>
            <p className="mt-1 text-xs uppercase tracking-[0.14em] text-secondary">Collaborative review thread</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container-highest hover:text-on-surface"
            aria-label="Close comments modal"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-8 overflow-y-auto px-6 py-6">
          {rootComments.length === 0 ? (
            <div className="rounded-lg border border-dashed border-outline/30 p-10 text-center text-on-surface-variant">
              <MessageSquare className="mx-auto mb-3" size={24} />
              No comments yet.
            </div>
          ) : (
            rootComments.map((comment) => (
              <div key={comment._id} className="space-y-4">
                <div className="rounded-lg border border-outline/15 bg-surface-container-low px-4 py-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-semibold text-on-surface">{comment.authorName}</span>
                    <span className="text-[10px] uppercase tracking-[0.12em] text-on-surface-variant">
                      {formatRelativeTime(comment.createdAt)}
                    </span>
                  </div>
                  <p className="leading-relaxed text-on-surface-variant">{comment.body}</p>
                  <button
                    onClick={() => setReplyParentId(comment._id)}
                    className="mt-3 inline-flex items-center gap-1 text-xs uppercase tracking-[0.1em] text-on-surface-variant transition-colors hover:text-primary"
                  >
                    <Reply size={13} />
                    Reply
                  </button>
                </div>

                {(repliesByParent[String(comment._id)] ?? []).map((reply) => (
                  <div
                    key={reply._id}
                    className="ml-8 rounded-lg border border-outline/10 bg-surface-container-high/40 px-4 py-3"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-semibold text-on-surface">{reply.authorName}</span>
                      <span className="text-[10px] uppercase tracking-[0.12em] text-on-surface-variant">
                        {formatRelativeTime(reply.createdAt)}
                      </span>
                    </div>
                    <p className="leading-relaxed text-on-surface-variant">{reply.body}</p>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>

        <div className="border-t border-outline/20 bg-surface-container-low px-6 py-5">
          {replyParentId && (
            <div className="mb-3 flex items-center justify-between rounded bg-primary/10 px-3 py-2 text-xs text-primary">
              <span>Replying to comment</span>
              <button onClick={() => setReplyParentId(null)} className="underline">
                Cancel
              </button>
            </div>
          )}
          <div className="flex items-end gap-3">
            <textarea
              rows={3}
              value={draftComment}
              onChange={(event) => setDraftComment(event.target.value)}
              placeholder="Add a comment..."
              className="w-full resize-none rounded-lg border border-outline/30 bg-surface-container-lowest p-3 text-on-surface placeholder:text-on-surface-variant focus:border-secondary focus:outline-none"
            />
            <button
              disabled={submitting || !draftComment.trim()}
              onClick={submitComment}
              className="inline-flex items-center gap-2 rounded bg-gradient-to-br from-primary to-[#44658b] px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-on-primary disabled:opacity-50"
            >
              <Send size={14} />
              Post
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
