import { useEffect, useMemo, useState } from "react";
import { MessageSquare, Reply, Send, X } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useTranslation } from "react-i18next";
import { formatRelativeTime } from "@/src/lib/ui-labels";
import type { ParagraphId } from "@/src/types/editorial";
import { addPrivateComment, listPrivateComments } from "@/src/lib/readerPrivateAnnotations";

interface ParagraphCommentsModalProps {
  paragraphId: ParagraphId | null;
  sermonId?: string;
  languageCode: string;
  open: boolean;
  storageMode?: "convex" | "localPrivate";
  onClose: () => void;
}

type UiComment = {
  _id: string;
  parentCommentId: string | null;
  authorName: string;
  body: string;
  createdAt: number;
};

export default function ParagraphCommentsModal({
  paragraphId,
  sermonId,
  languageCode,
  open,
  storageMode = "convex",
  onClose,
}: ParagraphCommentsModalProps) {
  const { t } = useTranslation();
  const isLocalPrivate = storageMode === "localPrivate";
  const commentsResult = useQuery(
    api.editorial.listComments,
    !isLocalPrivate && paragraphId
      ? { paragraphId, languageCode, paginationOpts: { cursor: null, numItems: 200 } }
      : "skip",
  );
  const addComment = useMutation(api.editorial.addComment);
  const [draftComment, setDraftComment] = useState("");
  const [replyParentId, setReplyParentId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [localComments, setLocalComments] = useState<UiComment[]>([]);

  useEffect(() => {
    if (!open || !paragraphId || !isLocalPrivate || !sermonId) return;
    listPrivateComments({
      sermonId,
      paragraphId,
      languageCode,
    })
      .then((rows) => {
        setLocalComments(
          rows.map((row) => ({
            _id: row.id,
            parentCommentId: row.parentId,
            authorName: row.authorName,
            body: row.body,
            createdAt: row.createdAt,
          })),
        );
      })
      .catch((error) => {
        console.error("Failed loading local comments", error);
      });
  }, [isLocalPrivate, open, paragraphId, sermonId, languageCode]);

  const comments: UiComment[] = useMemo(() => {
    if (isLocalPrivate) return localComments;
    return (commentsResult?.page ?? []).map((comment) => ({
      _id: String(comment._id),
      parentCommentId: comment.parentCommentId ? String(comment.parentCommentId) : null,
      authorName: comment.authorName,
      body: comment.body,
      createdAt: comment.createdAt,
    }));
  }, [isLocalPrivate, localComments, commentsResult]);
  const rootComments = useMemo(
    () => comments.filter((comment) => !comment.parentCommentId),
    [comments],
  );
  const repliesByParent = useMemo(() => {
    const grouped: Record<string, typeof comments> = {};
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
      if (isLocalPrivate && sermonId) {
        const created = await addPrivateComment({
          sermonId,
          paragraphId,
          languageCode,
          body,
          parentId: replyParentId,
          authorName: "You",
        });
        setLocalComments((prev) => [
          ...prev,
          {
            _id: created.id,
            parentCommentId: created.parentId,
            authorName: created.authorName,
            body: created.body,
            createdAt: created.createdAt,
          },
        ]);
      } else {
        await addComment({
          paragraphId,
          languageCode,
          body,
          parentCommentId: replyParentId ? (replyParentId as any) : undefined,
        });
      }
      setDraftComment("");
      setReplyParentId(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-120 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md md:p-6">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-outline/20 bg-surface-container shadow-[0_0_50px_rgba(0,0,0,0.5)]">
        <div className="flex items-center justify-between border-b border-outline/20 bg-surface-container-low px-8 py-6">
          <div>
            <h3 className="font-headline text-2xl text-on-surface">{t('editorial.paragraphComments')}</h3>
            <p className="mt-1 text-xs uppercase tracking-widest text-secondary">{t('editorial.collaborativeReview')}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container-highest hover:text-on-surface"
            aria-label={t('editorial.paragraphComments')}
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-10 overflow-y-auto px-8 py-8">
          {rootComments.length === 0 ? (
            <div className="rounded-lg border border-dashed border-outline/30 p-10 text-center text-on-surface-variant">
              <MessageSquare className="mx-auto mb-3" size={24} />
              {t('editorial.noComments')}
            </div>
          ) : (
            rootComments.map((comment) => (
              <div key={comment._id} className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-outline/30 bg-surface-container-high text-sm font-bold text-primary">
                    {comment.authorName.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold tracking-tight text-on-surface">{comment.authorName}</span>
                      <span className="text-[10px] uppercase tracking-[0.12em] text-on-surface-variant">
                        {formatRelativeTime(comment.createdAt, t)}
                      </span>
                    </div>
                    <p className="font-headline text-lg leading-relaxed text-on-surface-variant">{comment.body}</p>
                    <button
                      onClick={() => setReplyParentId(comment._id)}
                      className="mt-1 inline-flex items-center gap-1 text-xs uppercase tracking-widest text-on-surface-variant transition-colors hover:text-primary"
                    >
                      <Reply size={13} />
                      {t('common.reply')}
                    </button>
                  </div>
                </div>

                {(repliesByParent[String(comment._id)] ?? []).map((reply) => (
                  <div key={reply._id} className="ml-14 flex gap-3 opacity-90 transition-opacity hover:opacity-100">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-outline/20 bg-surface-container-high text-xs font-bold text-primary">
                      {reply.authorName.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="flex-1 rounded-lg border border-outline/10 bg-surface-container-high/40 px-4 py-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="font-semibold text-sm text-on-surface">{reply.authorName}</span>
                        <span className="text-[10px] uppercase tracking-[0.12em] text-on-surface-variant">
                          {formatRelativeTime(reply.createdAt, t)}
                        </span>
                      </div>
                      <p className="leading-relaxed text-on-surface-variant">{reply.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>

        <div className="border-t border-outline/20 bg-surface-container-low px-8 py-8">
          {replyParentId && (
            <div className="mb-3 flex items-center justify-between rounded bg-primary/10 px-3 py-2 text-xs text-primary">
              <span>{t('editorial.replyingToComment')}</span>
              <button onClick={() => setReplyParentId(null)} className="underline">
                {t('common.cancel')}
              </button>
            </div>
          )}
          <div className="relative flex items-end gap-3">
            <textarea
              rows={3}
              value={draftComment}
              onChange={(event) => setDraftComment(event.target.value)}
              placeholder={t('editorial.addCommentPlaceholder')}
              className="w-full resize-none rounded-lg border border-outline/30 bg-surface-container-lowest p-4 pr-28 text-on-surface placeholder:text-on-surface-variant focus:border-secondary focus:outline-none"
            />
            <button
              disabled={submitting || !draftComment.trim()}
              onClick={submitComment}
              className="absolute bottom-3 right-3 inline-flex items-center gap-2 rounded bg-linear-to-br from-primary to-primary-container px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-on-primary shadow-lg disabled:opacity-50"
            >
              <Send size={14} />
              {t('common.post')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
