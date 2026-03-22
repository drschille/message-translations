import {
  CheckCircle2,
  History,
  MessageSquare,
  Pencil,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { statusLabel } from "@/src/lib/ui-labels";
import type { ParagraphId } from "@/src/types/editorial";

export interface ParagraphBlockSegment {
  key: string;
  paragraphId: ParagraphId | null;
  order: number;
  sourceText: string;
  translatedText: string;
  status: string;
}

interface ParagraphBlockProps {
  segment: ParagraphBlockSegment;
  index: number;
  mode: "read" | "proofread";
  /** Only used in proofread mode inside ProofreadingWorkflow */
  isActiveEditing?: boolean;
  onOpenComments?: () => void;
  onOpenHistory?: () => void;
  onApprove?: () => void;
  onStartEditing?: () => void;
  children?: React.ReactNode;
}

function statusClasses(status: string) {
  if (status === "approved") return "bg-green-900/30 text-green-400 border-green-500/20";
  if (status === "needs_review") return "bg-secondary/10 text-secondary border-secondary/20";
  if (status === "drafting") return "bg-primary/15 text-primary border-primary/20";
  return "bg-surface-container-highest text-on-surface-variant border-outline/20";
}

export default function ParagraphBlock({
  segment,
  index,
  mode,
  isActiveEditing = false,
  onOpenComments,
  onOpenHistory,
  onApprove,
  onStartEditing,
  children,
}: ParagraphBlockProps) {
  const { t } = useTranslation();
  const isProofread = mode === "proofread";

  return (
    <div
      className={`group relative transition-all duration-300 ${
        isActiveEditing
          ? "rounded-xl border border-secondary/35 bg-surface-container-high shadow-2xl"
          : "border-b border-outline/10"
      }`}
    >
      {/* Active editing accent bar */}
      {isActiveEditing && (
        <div className="absolute inset-y-0 left-0 w-1 rounded-l-xl bg-secondary" />
      )}

      <div
        className={`${
          isProofread
            ? "grid grid-cols-1 lg:grid-cols-2"
            : ""
        } ${isActiveEditing ? "p-0" : ""}`}
      >
        {/* ── Original text column (proofread only) ── */}
        {isProofread && (
          <div
            className={`border-b border-outline/20 p-8 lg:border-b-0 lg:border-r ${
              isActiveEditing ? "bg-surface-container-highest/20" : ""
            }`}
          >
            <div className="mb-4 flex items-center gap-3">
              <span
                className={`text-[10px] font-bold uppercase tracking-widest ${
                  isActiveEditing ? "text-secondary" : "text-on-surface-variant"
                }`}
              >
                EN-US [{String(segment.order).padStart(3, "0")}]
              </span>
              {isActiveEditing && (
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-secondary" />
              )}
            </div>
            <p
              className={`font-headline leading-relaxed ${
                isActiveEditing
                  ? "text-xl text-on-surface"
                  : "text-lg italic text-on-surface-variant"
              }`}
            >
              {segment.sourceText}
            </p>
          </div>
        )}

        {/* ── Translation text column ── */}
        <div
          className={
            isProofread
              ? `relative bg-surface-container p-8 ${!isActiveEditing && segment.status !== "approved" && onStartEditing ? "cursor-pointer" : ""}`
              : `py-8 md:py-10`
          }
          onClick={
            isProofread && !isActiveEditing && segment.status !== "approved" && onStartEditing
              ? onStartEditing
              : undefined
          }
        >
          {/* Status bar + editorial actions (proofread) */}
          {isProofread && (
            <div className="mb-4 flex items-start justify-between gap-4" onClick={(e) => e.stopPropagation()}>
              <span
                className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] ${statusClasses(segment.status)}`}
              >
                {statusLabel(segment.status, t)}
              </span>

              {!isActiveEditing && (
                <div className="flex gap-2">
                  {segment.status === "needs_review" && segment.paragraphId && onApprove && (
                    <button
                      onClick={onApprove}
                      className="rounded p-1.5 text-primary transition-colors hover:bg-surface-container-highest"
                      aria-label={t("proofreading.approveSegment", { key: segment.key })}
                    >
                      <CheckCircle2 size={16} />
                    </button>
                  )}
                  {segment.status !== "approved" && onStartEditing && (
                    <button
                      onClick={onStartEditing}
                      className="rounded p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-highest hover:text-primary"
                      aria-label={t("proofreading.editSegment", { key: segment.key })}
                    >
                      <Pencil size={16} />
                    </button>
                  )}
                  {segment.paragraphId && (
                    <>
                      {onOpenHistory && (
                        <button
                          onClick={onOpenHistory}
                          className="rounded p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-highest"
                          aria-label={t("editorial.versionHistory")}
                        >
                          <History size={16} />
                        </button>
                      )}
                      {onOpenComments && (
                        <button
                          onClick={onOpenComments}
                          className="rounded p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-highest"
                          aria-label={t("editorial.paragraphComments")}
                        >
                          <MessageSquare size={16} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* If children are provided (e.g. editing textarea), render those instead */}
          {children ?? (
            <p
              className={`leading-[1.85] text-on-surface/90 ${
                !isProofread && segment.status === "draft" ? "text-on-surface/50" : ""
              }`}
            >
              {index === 0 ? (
                <>
                  <span className="float-left mr-3 font-headline text-6xl font-bold leading-[0.9] text-primary md:text-7xl">
                    {segment.translatedText[0]}
                  </span>
                  {segment.translatedText.slice(1)}
                </>
              ) : (
                segment.translatedText
              )}
            </p>
          )}

          {/* Draft overlay for proofread mode */}
          {isProofread && !isActiveEditing && segment.status === "draft" && onStartEditing && (
            <div className="absolute inset-0 flex items-center justify-center bg-surface-container/40 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                onClick={onStartEditing}
                className="inline-flex items-center gap-2 rounded-full border border-outline/30 bg-surface-container-highest px-6 py-2 text-xs font-bold uppercase tracking-[0.16em] shadow-[0_10px_24px_rgba(0,0,0,0.35)]"
              >
                <Pencil size={14} />
                {t("proofreading.resumeEditing")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
