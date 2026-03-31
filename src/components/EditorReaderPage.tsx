import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, ChevronLeft, ChevronUp } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router";
import { formatDate } from "@/src/lib/utils";
import { statusLabel } from "@/src/lib/ui-labels";
import type { ParagraphId, SermonId } from "@/src/types/editorial";
import type { Id } from "@/convex/_generated/dataModel";

type ProofreadingState = "queued" | "in_progress" | "done";
type ColumnMode = "one" | "two";
type Segment = {
  key: string;
  paragraphId: ParagraphId | null;
  order: number;
  sourceText: string;
  translatedText: string;
  status: "draft" | "drafting" | "needs_review" | "approved";
};

const fallbackSegments: Segment[] = [
  {
    key: "fb-1",
    paragraphId: null,
    order: 1,
    sourceText: "Good evening, friends. It's a privilege to be back here tonight.",
    translatedText: "God kveld, venner. Det er et privilegium å være tilbake her i kveld.",
    status: "approved",
  },
];

function isDraftLike(status: Segment["status"]) {
  return status === "draft" || status === "drafting";
}

export default function EditorReaderPage() {
  const { t, i18n } = useTranslation();
  const { sermonId: sermonIdParam } = useParams();
  const navigate = useNavigate();
  const sermonId = sermonIdParam as SermonId | undefined;
  const [columnMode, setColumnMode] = useState<ColumnMode>("two");
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");
  const [saving, setSaving] = useState(false);
  const [compareOpen, setCompareOpen] = useState<Record<string, boolean>>({});
  const [proofreadingState, setProofreadingStateUi] = useState<ProofreadingState>("queued");

  const sermon = useQuery(
    api.sermons.getById,
    sermonId ? { id: sermonId as Id<"sermons">, languageCode: i18n.language } : "skip",
  );
  const paragraphsResult = useQuery(
    api.editorial.listParagraphs,
    sermonId ? { sermonId, languageCode: i18n.language, paginationOpts: { cursor: null, numItems: 500 } } : "skip",
  );
  const versionsResult = useQuery(
    api.editorial.listPublishedVersions as any,
    sermonId ? { sermonId, paginationOpts: { cursor: null, numItems: 20 } } : "skip",
  );

  const ensureParagraphs = useMutation(api.editorial.ensureParagraphsForSermon);
  const updateParagraphDraft = useMutation(api.editorial.updateParagraphDraft);
  const updateParagraphStatus = useMutation(api.editorial.updateParagraphStatus);
  const setSermonProofreadingState = useMutation(api.editorial.setSermonProofreadingState as any);
  const publishSermonVersion = useMutation(api.editorial.publishSermonVersion as any);

  useEffect(() => {
    if (!sermonId) return;
    ensureParagraphs({ sermonId, languageCode: i18n.language }).catch((error) => {
      console.error("Failed ensuring paragraphs", error);
    });
  }, [sermonId, ensureParagraphs, i18n.language]);

  useEffect(() => {
    const state = (sermon?.proofreadingState ?? "queued") as ProofreadingState;
    setProofreadingStateUi(state);
  }, [sermon]);

  const segments: Segment[] = useMemo(() => {
    if (!paragraphsResult?.page || paragraphsResult.page.length === 0) return fallbackSegments;
    return paragraphsResult.page.map((p: any) => ({
      key: String(p._id),
      paragraphId: p._id as ParagraphId,
      order: p.order,
      sourceText: p.sourceText,
      translatedText: p.translatedText,
      status: p.status,
    }));
  }, [paragraphsResult]);

  const counts = useMemo(() => {
    const total = segments.length || 1;
    const approved = segments.filter((s) => s.status === "approved").length;
    const pending = segments.filter((s) => s.status === "needs_review").length;
    const draft = total - approved - pending;
    return {
      approved,
      pending,
      draft,
      approvedPct: Math.round((approved / total) * 100),
      pendingPct: Math.round((pending / total) * 100),
      draftPct: Math.round((draft / total) * 100),
    };
  }, [segments]);

  const startEditing = useCallback(
    async (segment: Segment) => {
      setEditingKey(segment.key);
      setDraftText(segment.translatedText);
      if (segment.paragraphId && segment.status !== "drafting") {
        await updateParagraphStatus({
          paragraphId: segment.paragraphId,
          languageCode: i18n.language,
          status: "drafting",
        });
      }
    },
    [updateParagraphStatus, i18n.language],
  );

  const saveEditing = useCallback(
    async (submitForReview: boolean) => {
      const segment = segments.find((s) => s.key === editingKey);
      if (!segment?.paragraphId) return;
      setSaving(true);
      try {
        await updateParagraphDraft({
          paragraphId: segment.paragraphId,
          languageCode: i18n.language,
          translatedText: draftText,
          submitForReview,
          reason: submitForReview
            ? "Submitted for review from editor route"
            : "Saved draft from editor route",
        });
        if (submitForReview) setEditingKey(null);
      } finally {
        setSaving(false);
      }
    },
    [segments, editingKey, updateParagraphDraft, i18n.language, draftText],
  );

  const publishCurrentVersion = async () => {
    if (!sermonId) return;
    try {
      await publishSermonVersion({
        sermonId,
        languageCode: i18n.language,
        reason: "Published from editor proofreader route",
      });
    } catch (error) {
      console.error("Failed publishing sermon version", error);
    }
  };

  const setProofreadingState = async (state: ProofreadingState) => {
    if (!sermonId) return;
    setProofreadingStateUi(state);
    try {
      await setSermonProofreadingState({ sermonId, state });
    } catch (error) {
      console.error("Failed updating proofreading state", error);
      setProofreadingStateUi((sermon?.proofreadingState ?? "queued") as ProofreadingState);
    }
  };

  if (sermon === undefined) {
    return (
      <main className="min-h-screen pt-30 px-6">
        <div className="text-on-surface-variant">{t("common.loading")}</div>
      </main>
    );
  }

  if (sermon === null) {
    return (
      <main className="min-h-screen pt-30 px-6">
        <button onClick={() => navigate("/editor/sermons")} className="text-primary hover:underline">
          {t("common.back")}
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-on-surface pt-24">
      <section className="px-6 md:px-8 pb-8 border-b border-outline/20">
        <button
          onClick={() => navigate("/editor/sermons")}
          className="mb-4 inline-flex items-center gap-2 rounded-md border border-outline/30 px-3 py-2 text-xs uppercase tracking-[0.16em] text-on-surface-variant hover:text-primary"
        >
          <ChevronLeft size={14} />
          {t("proofreading.backToArchive")}
        </button>
        <h1 className="font-headline text-4xl md:text-5xl">{sermon.title}</h1>
        <div className="mt-2 text-sm text-on-surface-variant">
          {formatDate(sermon.date, i18n.language)} • {sermon.location ?? "Jeffersonville, IN"}
        </div>
      </section>

      <section className="px-6 md:px-8 py-4 border-b border-outline/20 bg-background/95 backdrop-blur-sm sticky top-16 z-30">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-surface-container p-1 inline-flex">
              <button
                onClick={() => setColumnMode("one")}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold ${columnMode === "one" ? "bg-surface-container-high text-on-surface" : "text-on-surface-variant"}`}
              >
                {t("proofreading.mode.one", "En kolonne")}
              </button>
              <button
                onClick={() => setColumnMode("two")}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold ${columnMode === "two" ? "bg-surface-container-high text-on-surface" : "text-on-surface-variant"}`}
              >
                {t("proofreading.mode.two", "To kolonner")}
              </button>
            </div>
            <div className="inline-flex rounded-lg border border-outline/30 overflow-hidden">
              {(["queued", "in_progress", "done"] as const).map((state) => (
                <button
                  key={state}
                  onClick={() => setProofreadingState(state)}
                  className={`px-3 py-1.5 text-xs font-medium border-r last:border-r-0 border-outline/30 ${proofreadingState === state ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant"}`}
                >
                  {state === "queued"
                    ? t("proofreading.state.queued", "Queued")
                    : state === "in_progress"
                      ? t("proofreading.state.inProgress", "In progress")
                      : t("proofreading.state.done", "Done")}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs text-on-surface-variant">
              {t("proofreading.currentVersion", "Current version")}: v{sermon.currentVersion ?? 0}
            </div>
            <button
              disabled={proofreadingState !== "done"}
              onClick={publishCurrentVersion}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-on-primary disabled:opacity-50"
            >
              {t("proofreading.publishVersion", "Publish version")}
            </button>
          </div>
        </div>
      </section>

      <section className="px-6 md:px-8 py-8 grid gap-6 lg:grid-cols-[220px_1fr_280px]">
        <aside className="hidden lg:block">
          <div className="space-y-3 text-xs">
            <div className="flex justify-between"><span>{t("reader.statusApproved")}</span><span className="text-primary font-semibold">{counts.approved} · {counts.approvedPct}%</span></div>
            <div className="flex justify-between"><span>{t("reader.statusNeedsReview")}</span><span className="text-secondary font-semibold">{counts.pending} · {counts.pendingPct}%</span></div>
            <div className="flex justify-between"><span>{t("reader.statusDraft")}</span><span className="text-outline font-semibold">{counts.draft} · {counts.draftPct}%</span></div>
          </div>
        </aside>

        <article className="space-y-0">
          {columnMode === "two" && (
            <div className="mb-4 grid grid-cols-2 gap-8 border-b border-outline/20 pb-3 text-xs">
              <span className="text-outline">{t("reader.original", "Original")}</span>
              <span className="text-primary">{t("reader.translation", "Translation")}</span>
            </div>
          )}
          {segments.map((segment, index) => {
            const showOriginal = compareOpen[segment.key] ?? index === 0;
            const editing = editingKey === segment.key;
            const statusText = statusLabel(segment.status, t);

            return (
              <div key={segment.key} className={`${index % 2 === 0 ? "bg-background" : "bg-surface-container-low"} border-b border-outline/15 p-5`}>
                {columnMode === "two" ? (
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
                    <p className="italic text-on-surface-variant leading-relaxed">{segment.sourceText}</p>
                    <div className="space-y-3">
                      <div className="inline-flex items-center rounded border border-outline/30 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-on-surface-variant">
                        {statusText}
                      </div>
                      {editing ? (
                        <>
                          <textarea
                            value={draftText}
                            onChange={(e) => setDraftText(e.target.value)}
                            className="w-full min-h-28 bg-transparent border border-outline/30 rounded p-3 text-on-surface"
                          />
                          <div className="flex flex-wrap gap-2">
                            <button onClick={() => setEditingKey(null)} className="rounded border border-outline/30 px-3 py-1.5 text-xs">{t("common.discard")}</button>
                            <button disabled={saving} onClick={() => saveEditing(false)} className="rounded border border-outline/30 px-3 py-1.5 text-xs">{t("proofreading.saveDraft")}</button>
                            <button disabled={saving} onClick={() => saveEditing(true)} className="rounded bg-primary px-3 py-1.5 text-xs text-on-primary">{t("proofreading.submitForReview")}</button>
                          </div>
                        </>
                      ) : (
                        <>
                          <p className="leading-relaxed">{segment.translatedText}</p>
                          <div className="flex flex-wrap gap-2">
                            <button onClick={() => startEditing(segment)} className="rounded border border-outline/30 px-3 py-1.5 text-xs">{t("editorial.edit", "Rediger")}</button>
                            {segment.status === "needs_review" && segment.paragraphId && (
                              <button
                                onClick={() =>
                                  updateParagraphStatus({
                                    paragraphId: segment.paragraphId!,
                                    languageCode: i18n.language,
                                    status: "approved",
                                    reason: "Approved in editor route",
                                  })
                                }
                                className="rounded bg-primary px-3 py-1.5 text-xs text-on-primary"
                              >
                                {t("proofreading.approveSegment", "Approve")}
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="inline-flex items-center rounded border border-outline/30 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-on-surface-variant">
                        {statusText}
                      </div>
                      <button
                        onClick={() => setCompareOpen((prev) => ({ ...prev, [segment.key]: !showOriginal }))}
                        className="inline-flex items-center gap-1 rounded border border-outline/30 px-2 py-1 text-xs text-on-surface-variant"
                      >
                        {showOriginal ? t("editorial.hideCompare", "Skjul original") : t("editorial.compare", "Sammenlign")}
                        {showOriginal ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    </div>
                    {showOriginal && (
                      <div className="space-y-2">
                        <div className="text-[10px] uppercase tracking-[0.14em] text-outline">{t("reader.original", "Original")}</div>
                        <p className="italic text-on-surface-variant leading-relaxed">{segment.sourceText}</p>
                        <div className="h-px bg-outline/20" />
                      </div>
                    )}
                    {editing ? (
                      <>
                        <textarea
                          value={draftText}
                          onChange={(e) => setDraftText(e.target.value)}
                          className="w-full min-h-28 bg-transparent border border-outline/30 rounded p-3 text-on-surface"
                        />
                        <div className="flex flex-wrap gap-2">
                          <button onClick={() => setEditingKey(null)} className="rounded border border-outline/30 px-3 py-1.5 text-xs">{t("common.discard")}</button>
                          <button disabled={saving} onClick={() => saveEditing(false)} className="rounded border border-outline/30 px-3 py-1.5 text-xs">{t("proofreading.saveDraft")}</button>
                          <button disabled={saving} onClick={() => saveEditing(true)} className="rounded bg-primary px-3 py-1.5 text-xs text-on-primary">{t("proofreading.submitForReview")}</button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="leading-relaxed">{segment.translatedText}</p>
                        <div className="flex flex-wrap gap-2">
                          <button onClick={() => startEditing(segment)} className="rounded border border-outline/30 px-3 py-1.5 text-xs">{t("editorial.edit", "Rediger")}</button>
                          {segment.status === "needs_review" && segment.paragraphId && (
                            <button
                              onClick={() =>
                                updateParagraphStatus({
                                  paragraphId: segment.paragraphId!,
                                  languageCode: i18n.language,
                                  status: "approved",
                                  reason: "Approved in editor route",
                                })
                              }
                              className="rounded bg-primary px-3 py-1.5 text-xs text-on-primary"
                            >
                              <Check size={12} className="inline mr-1" />
                              {t("proofreading.approveSegment", "Approve")}
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </article>

        <aside className="space-y-3">
          <h3 className="font-headline text-lg">{t("editorial.versionHistory", "Version History")}</h3>
          {(versionsResult?.page ?? []).length === 0 ? (
            <div className="text-sm text-on-surface-variant">{t("editorial.noRevisions")}</div>
          ) : (
            (versionsResult?.page ?? []).map((v: any) => (
              <div key={v._id} className="rounded border border-outline/20 p-3 text-sm">
                <div className="font-semibold">v{v.version}</div>
                <div className="text-on-surface-variant">{formatDate(new Date(v.publishedAt).toISOString(), i18n.language)}</div>
              </div>
            ))
          )}
        </aside>
      </section>
    </main>
  );
}
