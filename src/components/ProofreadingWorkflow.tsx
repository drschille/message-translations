import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  FileOutput,
  Info,
  Save,
  Search,
} from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useTranslation } from "react-i18next";
import { formatRelativeTime } from "@/src/lib/ui-labels";
import { formatDate } from "@/src/lib/utils";
import ParagraphBlock from "@/src/components/ParagraphBlock";
import type { ParagraphBlockSegment } from "@/src/components/ParagraphBlock";
import ParagraphCommentsModal from "@/src/components/ParagraphCommentsModal";
import VersionHistoryModal from "@/src/components/VersionHistoryModal";
import type { ParagraphId, SermonId } from "@/src/types/editorial";

interface ProofreadingWorkflowProps {
  sermon?: any;
  onBack: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}

interface UiSegment extends ParagraphBlockSegment {
  sourceLabel: string;
  updatedAt?: number;
}

const fallbackSegments: UiSegment[] = [
  {
    key: "fallback-001",
    paragraphId: null,
    order: 1,
    sourceLabel: "EN-US [001]",
    sourceText:
      '"Good evening, friends. It\'s a privilege to be back here again tonight in the house of the Lord, to serve Him."',
    translatedText:
      '"God kveld, venner. Det er et privilegium å være tilbake her igjen i kveld i Herrens hus, for å tjene Ham."',
    status: "approved",
  },
  {
    key: "fallback-002",
    paragraphId: null,
    order: 2,
    sourceLabel: "EN-US [002]",
    sourceText:
      '"Now, we are thinking today of how that the world has come to its place where it is today. We are in a changing time."',
    translatedText:
      "Nå tenker vi i dag på hvordan verden har kommet til det stedet den er i dag. Vi er i en skiftende tid.",
    status: "drafting",
  },
  {
    key: "fallback-003",
    paragraphId: null,
    order: 3,
    sourceLabel: "EN-US [003]",
    sourceText:
      '"Everything is changing. Politics is changing; the world itself is changing. But God\'s Word remains the same."',
    translatedText:
      '"Alt forandrer seg. Politikken forandrer seg; selve verden forandrer seg. Men Guds Ord forblir det samme."',
    status: "needs_review",
  },
  {
    key: "fallback-004",
    paragraphId: null,
    order: 4,
    sourceLabel: "EN-US [004]",
    sourceText:
      '"And we must find that place that God has chosen for us to rest in. Not in some man-made idea, but in Christ."',
    translatedText:
      '"Og vi må finne det stedet som Gud har valgt ut for oss å hvile i. Ikke i en menneskeskapt idé, men i Kristus."',
    status: "draft",
  },
];

export default function ProofreadingWorkflow({ sermon, onBack, onDirtyChange }: ProofreadingWorkflowProps) {
  const { t, i18n } = useTranslation();
  const sermonId = sermon?._id as SermonId | undefined;
  const ensureParagraphs = useMutation(api.editorial.ensureParagraphsForSermon);
  const updateParagraphDraft = useMutation(api.editorial.updateParagraphDraft);
  const updateParagraphStatus = useMutation(api.editorial.updateParagraphStatus);
  const paragraphsResult = useQuery(
    api.editorial.listParagraphs,
    sermonId ? { sermonId, paginationOpts: { cursor: null, numItems: 500 } } : "skip",
  );

  const segments = useMemo<UiSegment[]>(() => {
    if (!paragraphsResult?.page || paragraphsResult.page.length === 0) {
      return fallbackSegments;
    }
    return paragraphsResult.page.map((paragraph) => ({
      key: String(paragraph._id),
      paragraphId: paragraph._id as ParagraphId,
      order: paragraph.order,
      sourceLabel: `EN-US [${String(paragraph.order).padStart(3, "0")}]`,
      sourceText: paragraph.sourceText,
      translatedText: paragraph.translatedText,
      status: paragraph.status,
      updatedAt: paragraph.updatedAt,
    }));
  }, [paragraphsResult]);

  const [activeSegmentId, setActiveSegmentId] = useState<string>(segments[0]?.key ?? fallbackSegments[0].key);
  const [draftText, setDraftText] = useState<string>(segments[0]?.translatedText ?? "");
  const [saving, setSaving] = useState(false);
  const [commentsParagraphId, setCommentsParagraphId] = useState<ParagraphId | null>(null);
  const [historyParagraphId, setHistoryParagraphId] = useState<ParagraphId | null>(null);

  const sermonTitle = sermon?.title ?? "Det Valgte Hvilested";
  const sermonDate = sermon?.date ? formatDate(sermon.date, i18n.language) : "13. MAI 1965";
  const sermonCode = sermon?._id ?? "65-0221E";

  useEffect(() => {
    if (!sermonId) return;
    ensureParagraphs({ sermonId }).catch((error) => {
      console.error("Failed to seed sermon paragraphs", error);
    });
  }, [sermonId, ensureParagraphs]);

  useEffect(() => {
    if (!segments.length) return;
    if (!segments.find((s) => s.key === activeSegmentId)) {
      setActiveSegmentId(segments[0].key);
    }
  }, [activeSegmentId, segments]);

  const activeSegment = useMemo(
    () => segments.find((s) => s.key === activeSegmentId) ?? segments[0],
    [activeSegmentId, segments],
  );

  useEffect(() => {
    if (!activeSegment) return;
    setDraftText(activeSegment.translatedText);
  }, [activeSegment]);

  const completion = useMemo(() => {
    if (!segments.length) return 0;
    const approved = segments.filter((s) => s.status === "approved").length;
    return Math.round((approved / segments.length) * 100);
  }, [segments]);

  const lastSyncAt = useMemo(() => {
    const latest = segments.reduce<number>(
      (max, s) => (s.updatedAt && s.updatedAt > max ? s.updatedAt : max),
      0,
    );
    return latest > 0 ? latest : Date.now();
  }, [segments]);

  const lastSyncText = useMemo(() => formatRelativeTime(lastSyncAt, t), [lastSyncAt, t]);

  const historySegment = useMemo(
    () => segments.find((s) => s.paragraphId === historyParagraphId) ?? null,
    [historyParagraphId, segments],
  );

  const startEditing = async (segment: UiSegment) => {
    setActiveSegmentId(segment.key);
    if (!segment.paragraphId || segment.status === "approved") return;
    if (segment.status !== "drafting") {
      await updateParagraphStatus({ paragraphId: segment.paragraphId, status: "drafting" });
    }
  };

  const saveDraft = async () => {
    if (!activeSegment?.paragraphId) return;
    setSaving(true);
    try {
      await updateParagraphDraft({
        paragraphId: activeSegment.paragraphId,
        translatedText: draftText,
        reason: "Saved from proofreading workflow",
      });
    } finally {
      setSaving(false);
    }
  };

  const discardDraft = () => {
    if (!activeSegment) return;
    setDraftText(activeSegment.translatedText);
  };

  const approveSegment = async (paragraphId: ParagraphId) => {
    await updateParagraphStatus({
      paragraphId,
      status: "approved",
      reason: "Approved in proofreading workflow",
    });
  };

  const isDirty = useMemo(() => {
    if (!activeSegment || activeSegment.status !== "drafting") return false;
    return draftText.trim() !== activeSegment.translatedText.trim();
  }, [activeSegment, draftText]);

  useEffect(() => { onDirtyChange?.(isDirty); }, [isDirty, onDirtyChange]);
  useEffect(() => { return () => onDirtyChange?.(false); }, [onDirtyChange]);

  return (
    <>
      <main className="min-h-screen bg-background px-4 pb-16 pt-24 text-on-surface md:px-8">
        <div className="mx-auto max-w-[1280px]">
          <button
            onClick={onBack}
            className="mb-8 inline-flex items-center gap-2 rounded-md border border-outline/30 bg-surface-container-low px-3 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant transition hover:border-primary/60 hover:text-primary"
          >
            <ChevronLeft size={14} />
            {t("proofreading.backToArchive")}
          </button>

          {/* Header with completion stats */}
          <section className="mb-10 flex flex-col gap-6 border-b border-outline/20 pb-8 md:flex-row md:items-end md:justify-between">
            <div className="flex-1">
              <div className="mb-3 flex items-center gap-3">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
                  {t("proofreading.project")}
                </span>
                <span className="h-1 w-1 rounded-full bg-outline" />
                <span className="text-[10px] uppercase tracking-[0.2em] text-on-surface-variant">
                  {t("proofreading.archiveName")}
                </span>
              </div>
              <h1 className="mb-2 font-headline text-4xl font-bold tracking-tight md:text-5xl">
                {sermonTitle}
              </h1>
              <p className="font-medium tracking-wide text-on-surface-variant">
                The Chosen Place of Rest - Jeffersonville, IN - {sermonCode} - {sermonDate}
              </p>
            </div>

            <div className="w-full md:w-64">
              <div className="rounded-xl border border-outline/20 bg-surface-container-low p-5 shadow-[0_14px_34px_rgba(0,0,0,0.22)]">
                <div className="mb-3 flex items-end justify-between">
                  <div>
                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
                      {t("proofreading.completion")}
                    </span>
                    <span className="font-headline text-2xl font-bold text-primary">{completion}%</span>
                  </div>
                  <div className="text-right">
                    <span className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-on-surface-variant">
                      {t("proofreading.lastSync")}
                    </span>
                    <span className="text-xs font-mono text-primary/90">{lastSyncText}</span>
                  </div>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-highest">
                  <div
                    className="h-full bg-primary shadow-[0_0_8px_rgba(168,201,244,0.4)] transition-all duration-300"
                    style={{ width: `${completion}%` }}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Paragraph segments — using shared ParagraphBlock */}
          <section className="space-y-6">
            {segments.map((segment, index) => {
              const isActive = segment.key === activeSegmentId && segment.status === "drafting";

              return (
                <ParagraphBlock
                  key={segment.key}
                  segment={segment}
                  index={index}
                  mode="proofread"
                  isActiveEditing={isActive}
                  onApprove={
                    segment.paragraphId
                      ? () => approveSegment(segment.paragraphId!)
                      : undefined
                  }
                  onStartEditing={() => startEditing(segment)}
                  onOpenHistory={
                    segment.paragraphId
                      ? () => setHistoryParagraphId(segment.paragraphId)
                      : undefined
                  }
                  onOpenComments={
                    segment.paragraphId
                      ? () => setCommentsParagraphId(segment.paragraphId)
                      : undefined
                  }
                >
                  {/* Custom children for active editing state */}
                  {isActive ? (
                    <>
                      <textarea
                        className="h-36 w-full resize-none border-none bg-transparent p-0 font-headline text-xl leading-relaxed text-on-surface focus:ring-0"
                        spellCheck={false}
                        value={draftText}
                        onChange={(e) => setDraftText(e.target.value)}
                      />
                      <div className="mt-6 flex justify-end gap-3">
                        <button
                          onClick={discardDraft}
                          className="px-4 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-on-surface-variant transition-colors hover:text-on-surface"
                        >
                          {t("common.discard")}
                        </button>
                        <button
                          disabled={saving}
                          onClick={saveDraft}
                          className="rounded bg-gradient-to-br from-primary to-[#44658b] px-6 py-2 text-xs font-bold uppercase tracking-[0.16em] text-on-primary shadow-lg disabled:opacity-50"
                        >
                          {t("common.save")}
                        </button>
                      </div>
                    </>
                  ) : undefined}
                </ParagraphBlock>
              );
            })}
          </section>

          {/* Pagination */}
          <section className="mb-24 mt-16 flex items-center justify-between border-t border-outline/20 pt-8">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-on-surface-variant transition-colors hover:text-primary"
            >
              <ArrowLeft size={14} />
              {t("proofreading.previousPage")}
            </button>
            <div className="flex gap-2">
              <span className="h-2 w-2 rounded-full bg-primary" />
              <span className="h-2 w-2 rounded-full bg-surface-container-highest" />
              <span className="h-2 w-2 rounded-full bg-surface-container-highest" />
              <span className="h-2 w-2 rounded-full bg-surface-container-highest" />
            </div>
            <button className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-on-surface-variant transition-colors hover:text-primary">
              {t("proofreading.nextPage")}
              <ArrowRight size={14} />
            </button>
          </section>
        </div>

        {/* FAB buttons */}
        <div className="fixed bottom-8 right-4 z-50 flex flex-col gap-3 md:right-8">
          <button
            className="flex h-14 w-14 items-center justify-center rounded-full border border-secondary/20 bg-surface-container-highest text-secondary shadow-xl transition-transform hover:scale-105"
            title={t("proofreading.searchArchives")}
          >
            <Search size={20} />
          </button>
          <button
            className="flex h-14 w-14 items-center justify-center rounded-full border border-primary/20 bg-surface-container-highest text-primary shadow-xl transition-transform hover:scale-105"
            title={t("proofreading.metadataSettings")}
          >
            <Info size={20} />
          </button>
          <button
            onClick={saveDraft}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-on-primary shadow-xl transition-transform hover:scale-105"
            title={t("proofreading.saveActiveChanges")}
          >
            <Save size={20} />
          </button>
          <button className="mt-2 inline-flex h-14 items-center gap-2 rounded-full bg-gradient-to-br from-secondary to-[#584633] px-6 text-xs font-bold uppercase tracking-[0.16em] text-on-secondary shadow-xl transition-transform hover:scale-105">
            <FileOutput size={18} />
            {t("proofreading.exportDraft")}
          </button>
        </div>
      </main>

      <ParagraphCommentsModal
        paragraphId={commentsParagraphId}
        open={Boolean(commentsParagraphId)}
        onClose={() => setCommentsParagraphId(null)}
      />
      <VersionHistoryModal
        paragraphId={historyParagraphId}
        currentText={historySegment?.translatedText ?? ""}
        open={Boolean(historyParagraphId)}
        onClose={() => setHistoryParagraphId(null)}
      />
    </>
  );
}
