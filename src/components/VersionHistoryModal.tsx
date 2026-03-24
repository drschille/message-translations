import { useMemo, useState } from "react";
import { CheckCircle2, History, RotateCcw, X } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useTranslation } from "react-i18next";
import { statusLabel, formatRelativeTime } from "@/src/lib/ui-labels";
import type { Id } from "@/convex/_generated/dataModel";
import type { ParagraphId } from "@/src/types/editorial";

interface VersionHistoryModalProps {
  paragraphId: ParagraphId | null;
  currentText: string;
  open: boolean;
  onClose: () => void;
}

interface DiffToken {
  text: string;
  type: "same" | "add" | "remove";
}

function tokenize(text: string): string[] {
  return text.split(/(\s+)/).filter((token) => token.length > 0);
}

function diffWords(previous: string, current: string): DiffToken[] {
  const a = tokenize(previous);
  const b = tokenize(current);
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));

  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      if (a[i] === b[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const tokens: DiffToken[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      tokens.push({ text: a[i], type: "same" });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      tokens.push({ text: a[i], type: "remove" });
      i++;
    } else {
      tokens.push({ text: b[j], type: "add" });
      j++;
    }
  }
  while (i < a.length) {
    tokens.push({ text: a[i], type: "remove" });
    i++;
  }
  while (j < b.length) {
    tokens.push({ text: b[j], type: "add" });
    j++;
  }

  return tokens;
}

export default function VersionHistoryModal({
  paragraphId,
  currentText,
  open,
  onClose,
}: VersionHistoryModalProps) {
  const { t } = useTranslation();
  const revisionsResult = useQuery(
    api.editorial.listRevisions,
    paragraphId ? { paragraphId, paginationOpts: { cursor: null, numItems: 200 } } : "skip",
  );
  const restoreRevision = useMutation(api.editorial.restoreRevision);
  const [compareRevisionId, setCompareRevisionId] = useState<Id<"paragraphRevisions"> | null>(null);
  const [restoring, setRestoring] = useState(false);

  const revisions = useMemo(() => revisionsResult?.page ?? [], [revisionsResult]);

  if (!open || !paragraphId) return null;

  const onRestore = async (revisionId: Id<"paragraphRevisions">) => {
    if (!window.confirm(t('editorial.confirmRestore'))) return;
    setRestoring(true);
    try {
      await restoreRevision({
        paragraphId,
        revisionId,
      });
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="fixed inset-0 z-120 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md md:p-6">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-outline/20 bg-surface-container shadow-[0_0_50px_rgba(0,0,0,0.5)]">
        <div className="flex items-center justify-between border-b border-outline/20 bg-surface-container-low px-8 py-6">
          <div>
            <h3 className="inline-flex items-center gap-2 font-headline text-2xl text-on-surface">
              <History size={20} />
              {t('editorial.versionHistory')}
            </h3>
            <p className="mt-1 text-xs uppercase tracking-widest text-secondary">
              {t('editorial.compareAndRestore')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container-highest hover:text-on-surface"
            aria-label={t('editorial.versionHistory')}
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-8 py-8">
          {revisions.length === 0 ? (
            <div className="rounded-lg border border-dashed border-outline/30 p-10 text-center text-on-surface-variant">
              {t('editorial.noRevisions')}
            </div>
          ) : (
            revisions.map((revision) => {
              const isComparing = compareRevisionId === revision._id;
              const tokens = isComparing ? diffWords(revision.snapshotText, currentText) : [];
              return (
                <div key={revision._id} className="rounded-lg border border-outline/20 bg-surface-container-low p-5">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-primary">
                          {revision.kind === "restore" ? t('editorial.restore') : t('editorial.edit')}
                        </span>
                        <span className="text-sm font-semibold text-on-surface">{statusLabel(revision.status, t)}</span>
                      </div>
                      <div className="mt-1 text-xs text-on-surface-variant">
                        {revision.authorName} • {formatRelativeTime(revision.createdAt, t)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCompareRevisionId((prev) => (prev === revision._id ? null : revision._id))}
                        className="rounded border border-outline/30 px-3 py-1.5 text-xs uppercase tracking-[0.12em] text-on-surface-variant transition hover:bg-surface-container-high hover:text-on-surface"
                      >
                        {isComparing ? t('editorial.hideCompare') : t('editorial.compare')}
                      </button>
                      <button
                        disabled={restoring}
                        onClick={() => onRestore(revision._id)}
                        className="inline-flex items-center gap-1 rounded bg-surface-container-highest px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-primary transition hover:bg-primary hover:text-on-primary disabled:opacity-50"
                      >
                        <RotateCcw size={12} />
                        {t('editorial.restore')}
                      </button>
                    </div>
                  </div>

                  <p className="rounded border border-outline/10 bg-surface-container p-4 font-headline leading-relaxed text-on-surface">
                    {revision.snapshotText}
                  </p>

                  {isComparing && (
                    <div className="mt-3 rounded border border-outline/10 bg-surface-container p-4">
                      <div className="mb-2 inline-flex items-center gap-2 text-xs uppercase tracking-widest text-secondary">
                        <CheckCircle2 size={12} />
                        {t('editorial.diffVsCurrent')}
                      </div>
                      <p className="leading-relaxed text-on-surface">
                        {tokens.map((token, index) => (
                          <span
                            key={`${token.text}-${index}`}
                            className={
                              token.type === "add"
                                ? "bg-green-900/40 text-green-300"
                                : token.type === "remove"
                                  ? "bg-red-900/30 text-red-300 line-through"
                                  : ""
                            }
                          >
                            {token.text}
                          </span>
                        ))}
                      </p>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
