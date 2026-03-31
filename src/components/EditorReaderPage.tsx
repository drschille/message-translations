import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Circle,
  Clock3,
  Columns2,
  FileEdit,
  MessageSquareText,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router";
import { formatDate } from "@/src/lib/utils";
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

function normalizeLanguageCode(i18nLanguage: string) {
  const v = (i18nLanguage || "nb").toLowerCase();
  if (v === "no" || v.startsWith("nb")) return "nb";
  return "en";
}

function statusMeta(status: Segment["status"], t: any) {
  if (status === "approved") {
    return {
      label: t("reader.statusApproved", "Godkjent"),
      icon: <CheckCircle2 size={12} className="text-primary/75" />,
    };
  }
  if (status === "needs_review") {
    return {
      label: t("reader.statusNeedsReview", "Venter"),
      icon: <Clock3 size={12} className="text-secondary/75" />,
    };
  }
  return {
    label: t("reader.statusDraft", "Utkast"),
    icon: <Circle size={10} className="text-outline" />,
  };
}

function rowTone(index: number) {
  return index % 2 === 0 ? "bg-background" : "bg-surface-container-low/30";
}

export default function EditorReaderPage() {
  const { t, i18n } = useTranslation();
  const { sermonId: sermonIdParam } = useParams();
  const navigate = useNavigate();
  const sermonId = sermonIdParam as SermonId | undefined;
  const languageCode = normalizeLanguageCode(i18n.language);

  const [columnMode, setColumnMode] = useState<ColumnMode>("two");
  const [compareOpen, setCompareOpen] = useState<Record<string, boolean>>({});
  const [proofreadingState, setProofreadingStateUi] = useState<ProofreadingState>("queued");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busyKeys, setBusyKeys] = useState<Record<string, boolean>>({});
  const [reviewsCollapsed, setReviewsCollapsed] = useState(true);

  const sermon = useQuery(
    api.sermons.getById,
    sermonId ? { id: sermonId as Id<"sermons">, languageCode } : "skip",
  );
  const paragraphsResult = useQuery(
    api.editorial.listParagraphs,
    sermonId ? { sermonId, languageCode, paginationOpts: { cursor: null, numItems: 500 } } : "skip",
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
    ensureParagraphs({ sermonId, languageCode }).catch((error) => {
      console.error("Failed ensuring paragraphs", error);
    });
  }, [sermonId, ensureParagraphs, languageCode]);

  useEffect(() => {
    const state = (sermon?.proofreadingState ?? "queued") as ProofreadingState;
    setProofreadingStateUi(state);
  }, [sermon]);

  const segments = useMemo<Segment[]>(() => {
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

  useEffect(() => {
    setDrafts((prev) => {
      const next = { ...prev };
      for (const segment of segments) {
        if (!(segment.key in next)) {
          next[segment.key] = segment.translatedText;
        }
      }
      return next;
    });
  }, [segments]);

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
      progressPct: Math.round((approved / total) * 100),
    };
  }, [segments]);

  const pendingSegments = useMemo(
    () => segments.filter((segment) => segment.status === "needs_review"),
    [segments],
  );

  const setBusy = (key: string, busy: boolean) => {
    setBusyKeys((prev) => ({ ...prev, [key]: busy }));
  };

  const ensureDrafting = useCallback(
    async (segment: Segment) => {
      if (!segment.paragraphId || segment.status !== "approved") return;
      setBusy(segment.key, true);
      try {
        await updateParagraphStatus({
          paragraphId: segment.paragraphId,
          languageCode,
          status: "drafting",
          reason: "Edit requested in editor proofreader",
        });
      } finally {
        setBusy(segment.key, false);
      }
    },
    [updateParagraphStatus, languageCode],
  );

  const saveDraft = useCallback(
    async (segment: Segment, submitForReview = false) => {
      if (!segment.paragraphId) return;
      setBusy(segment.key, true);
      try {
        await updateParagraphDraft({
          paragraphId: segment.paragraphId,
          languageCode,
          translatedText: drafts[segment.key] ?? segment.translatedText,
          reason: submitForReview
            ? "Submitted for review from editor proofreader"
            : "Saved draft from editor proofreader",
          submitForReview,
        });
      } finally {
        setBusy(segment.key, false);
      }
    },
    [updateParagraphDraft, languageCode, drafts],
  );

  const approve = useCallback(
    async (segment: Segment) => {
      if (!segment.paragraphId) return;
      setBusy(segment.key, true);
      try {
        await updateParagraphStatus({
          paragraphId: segment.paragraphId,
          languageCode,
          status: "approved",
          reason: "Approved in editor proofreader",
        });
      } finally {
        setBusy(segment.key, false);
      }
    },
    [updateParagraphStatus, languageCode],
  );

  const publishCurrentVersion = async () => {
    if (!sermonId) return;
    await publishSermonVersion({
      sermonId,
      languageCode,
      reason: "Published from editor proofreader",
    });
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
    <main className="min-h-screen bg-background text-on-surface pt-16">
      <section className="px-6 md:px-20 pt-10 pb-8 border-b border-outline/20">
        <h1 className="font-headline text-4xl md:text-5xl tracking-tight">{sermon.title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.12em] text-on-surface-variant">
          <span>{formatDate(sermon.date, languageCode)}</span>
          <span className="h-1 w-1 rounded-full bg-outline" />
          <span>{sermon.series ?? t("common.series")}</span>
          <span className="h-1 w-1 rounded-full bg-outline" />
          <span>{sermon.location ?? "Jeffersonville, IN"}</span>
        </div>
      </section>

      <section className="sticky top-16 z-40 border-b border-outline/20 bg-surface-container-low/95 backdrop-blur-sm">
        <div className="px-6 md:px-8 py-3 flex items-center justify-between gap-4 flex-wrap">
          <button
            onClick={() => navigate("/editor/sermons")}
            className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-on-surface-variant hover:text-primary"
          >
            <ChevronLeft size={14} />
            {t("proofreading.backToArchive")}
          </button>

          <div className="rounded-lg bg-surface-container p-1 inline-flex gap-1">
            <button
              onClick={() => setColumnMode("one")}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium ${
                columnMode === "one"
                  ? "bg-primary text-on-primary"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <FileEdit size={13} />
              {t("proofreading.mode.one", "En kolonne")}
            </button>
            <button
              onClick={() => setColumnMode("two")}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium ${
                columnMode === "two"
                  ? "bg-primary text-on-primary"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <Columns2 size={13} />
              {t("proofreading.mode.two", "To kolonner")}
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setReviewsCollapsed((prev) => !prev)}
              className="hidden lg:inline-flex items-center gap-1.5 rounded-md border border-outline/30 px-3 py-1.5 text-xs text-on-surface-variant hover:text-on-surface"
            >
              {reviewsCollapsed ? <PanelRightOpen size={14} /> : <PanelRightClose size={14} />}
              {t("editorial.commentsAndReviews", "Kommentarer og vurderinger")}
            </button>
            <div className="inline-flex rounded-lg border border-outline/30 overflow-hidden">
              {(["queued", "in_progress", "done"] as const).map((state) => (
                <button
                  key={state}
                  onClick={() => setProofreadingState(state)}
                  className={`px-3 py-1.5 text-xs font-medium border-r last:border-r-0 border-outline/30 ${
                    proofreadingState === state
                      ? "bg-primary text-on-primary"
                      : "bg-surface-container text-on-surface-variant"
                  }`}
                >
                  {state === "queued"
                    ? t("proofreading.state.queued", "Queued")
                    : state === "in_progress"
                      ? t("proofreading.state.inProgress", "In progress")
                      : t("proofreading.state.done", "Done")}
                </button>
              ))}
            </div>
            <span className="text-[11px] text-on-surface-variant">
              {t("proofreading.currentVersion", "Version")}: v{sermon.currentVersion ?? 0}
            </span>
            <button
              disabled={proofreadingState !== "done"}
              onClick={publishCurrentVersion}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary disabled:opacity-45"
            >
              {t("proofreading.publishVersion", "Publiser versjon")}
            </button>
          </div>
        </div>
      </section>

      <section
        className={`grid gap-0 ${
          reviewsCollapsed ? "lg:grid-cols-[200px_1fr_48px]" : "lg:grid-cols-[200px_1fr_340px]"
        }`}
      >
        <aside className="hidden lg:block lg:sticky lg:top-32 self-start px-4 pt-12 pb-6">
          <div className="space-y-4">
            <div className="text-[10px] uppercase tracking-[0.14em] text-outline">
              {t("reader.readProgress")}
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-surface-container-high">
              <div className="h-full bg-primary" style={{ width: `${counts.progressPct}%` }} />
            </div>
          </div>
          <div className="mt-6 border-t border-outline/20 pt-4 space-y-3">
            <div className="text-[10px] uppercase tracking-[0.14em] text-outline">
              {t("reader.statusBreakdown")}
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-on-surface-variant">{t("reader.statusApproved")}</span>
              <span className="text-primary">{counts.approved} · {counts.approvedPct}%</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-on-surface-variant">{t("reader.statusNeedsReview")}</span>
              <span className="text-secondary">{counts.pending} · {counts.pendingPct}%</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-on-surface-variant">{t("reader.statusDraft")}</span>
              <span className="text-outline">{counts.draft} · {counts.draftPct}%</span>
            </div>
          </div>
        </aside>

        <article className="text-on-surface">
          <div className="px-8 py-3 border-b border-outline/20 bg-surface-container-low/35 text-[11px] uppercase tracking-[0.12em]">
            {columnMode === "two" ? (
              <div className="grid grid-cols-[1fr_1fr] gap-8">
                <span className="text-outline">English (Original)</span>
                <span className="text-on-surface-variant">Norsk (Oversettelse)</span>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-4">
                <span className="text-on-surface-variant">Norsk (Oversatt)</span>
                <span className="text-outline">{t("proofreading.singleColumnHint", "Kun oversatt tekst vises som standard")}</span>
              </div>
            )}
          </div>

          {segments.map((segment, index) => {
            const state = statusMeta(segment.status, t);
            const compareIsOpen = compareOpen[segment.key] ?? index === 0;
            const currentText = drafts[segment.key] ?? segment.translatedText;
            const dirty = currentText.trim() !== segment.translatedText.trim();
            const lockedApproved = segment.status === "approved";
            const saving = !!busyKeys[segment.key];

            return (
              <div key={segment.key} className={`border-b border-outline/20 ${rowTone(index)} px-8 py-5`}>
                {columnMode === "two" ? (
                  <div className="grid grid-cols-[auto_1fr_1fr] gap-6">
                    <div className="pt-1 text-[11px] text-outline/70">{segment.order}</div>
                    <div className="pr-4 border-r border-outline/25">
                      <p className="italic text-on-surface-variant leading-relaxed">{segment.sourceText}</p>
                    </div>
                    <div className="space-y-3 pl-2">
                      <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] text-on-surface-variant">
                        {state.icon}
                        <span>{state.label}</span>
                      </div>
                      <textarea
                        value={currentText}
                        disabled={lockedApproved || saving}
                        onChange={(e) => setDrafts((prev) => ({ ...prev, [segment.key]: e.target.value }))}
                        onBlur={() => {
                          if (!lockedApproved && dirty) {
                            saveDraft(segment, false).catch((e) => console.error(e));
                          }
                        }}
                        className={`w-full min-h-20 resize-y bg-transparent rounded px-0 py-0 text-on-surface leading-relaxed ${
                          lockedApproved
                            ? "opacity-95 cursor-default"
                            : "focus:outline-none focus:ring-0"
                        }`}
                      />
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {segment.status === "approved" && (
                          <button
                            onClick={() => ensureDrafting(segment)}
                            disabled={saving}
                            className="rounded border border-outline/30 px-2.5 py-1 text-on-surface-variant hover:text-on-surface"
                          >
                            {t("editorial.edit", "Rediger")}
                          </button>
                        )}
                        {(segment.status === "draft" || segment.status === "drafting") && (
                          <>
                            <button
                              onClick={() => saveDraft(segment, true)}
                              disabled={saving}
                              className="rounded border border-outline/30 px-2.5 py-1 text-on-surface-variant hover:text-on-surface"
                            >
                              {t("proofreading.requestApproval", "Be om godkjenning")}
                            </button>
                            <button
                              onClick={() => setDrafts((prev) => ({ ...prev, [segment.key]: segment.translatedText }))}
                              disabled={saving || !dirty}
                              className="rounded border border-outline/30 px-2.5 py-1 text-on-surface-variant disabled:opacity-45"
                            >
                              {t("proofreading.revertDraftChanges", "Tilbakestill endringer")}
                            </button>
                          </>
                        )}
                        {segment.status === "needs_review" && (
                          <button
                            onClick={() => approve(segment)}
                            disabled={saving}
                            className="rounded border border-outline/30 px-2.5 py-1 text-on-surface-variant hover:text-on-surface"
                          >
                            {t("proofreading.approveSegment", "Godkjenn")}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] text-on-surface-variant">
                        {state.icon}
                        <span>{state.label}</span>
                      </div>
                      <button
                        onClick={() => setCompareOpen((prev) => ({ ...prev, [segment.key]: !compareIsOpen }))}
                        className="inline-flex items-center gap-1 rounded border border-outline/30 px-2 py-1 text-[11px] text-on-surface-variant"
                      >
                        {compareIsOpen ? t("editorial.hideCompare", "Skjul original") : t("editorial.compare", "Sammenlign")}
                        {compareIsOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </button>
                    </div>

                    {compareIsOpen && (
                      <div className="space-y-2">
                        <div className="text-[10px] uppercase tracking-[0.14em] text-outline">
                          {t("reader.original", "Original")}
                        </div>
                        <p className="italic text-on-surface-variant leading-relaxed">{segment.sourceText}</p>
                        <div className="h-px bg-outline/35" />
                      </div>
                    )}

                    <textarea
                      value={currentText}
                      disabled={lockedApproved || saving}
                      onChange={(e) => setDrafts((prev) => ({ ...prev, [segment.key]: e.target.value }))}
                      onBlur={() => {
                        if (!lockedApproved && dirty) {
                          saveDraft(segment, false).catch((e) => console.error(e));
                        }
                      }}
                      className={`w-full min-h-20 resize-y bg-transparent rounded px-0 py-0 text-on-surface leading-relaxed ${
                        lockedApproved
                          ? "opacity-95 cursor-default"
                          : "focus:outline-none focus:ring-0"
                      }`}
                    />

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {segment.status === "approved" && (
                        <button
                          onClick={() => ensureDrafting(segment)}
                          disabled={saving}
                          className="rounded border border-outline/30 px-2.5 py-1 text-on-surface-variant hover:text-on-surface"
                        >
                          {t("editorial.edit", "Rediger")}
                        </button>
                      )}
                      {(segment.status === "draft" || segment.status === "drafting") && (
                        <>
                          <button
                            onClick={() => saveDraft(segment, true)}
                            disabled={saving}
                            className="rounded border border-outline/30 px-2.5 py-1 text-on-surface-variant hover:text-on-surface"
                          >
                            {t("proofreading.requestApproval", "Be om godkjenning")}
                          </button>
                          <button
                            onClick={() => setDrafts((prev) => ({ ...prev, [segment.key]: segment.translatedText }))}
                            disabled={saving || !dirty}
                            className="rounded border border-outline/30 px-2.5 py-1 text-on-surface-variant disabled:opacity-45"
                          >
                            {t("proofreading.revertDraftChanges", "Tilbakestill endringer")}
                          </button>
                        </>
                      )}
                      {segment.status === "needs_review" && (
                        <button
                          onClick={() => approve(segment)}
                          disabled={saving}
                          className="rounded border border-outline/30 px-2.5 py-1 text-on-surface-variant hover:text-on-surface"
                        >
                          <Check size={12} className="inline mr-1" />
                          {t("proofreading.approveSegment", "Godkjenn")}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </article>

        {reviewsCollapsed ? (
          <aside className="hidden lg:flex lg:sticky lg:top-32 self-start bg-surface-container-low/35 items-start justify-center pt-8">
            <button
              onClick={() => setReviewsCollapsed(false)}
              className="inline-flex flex-col items-center gap-2 text-on-surface-variant hover:text-on-surface"
              aria-label={t("editorial.expandReviewsPanel", "Utvid kommentarer og vurderinger")}
            >
              <MessageSquareText size={18} />
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/25 px-1.5 text-[10px] text-primary">
                {pendingSegments.length}
              </span>
              <PanelRightOpen size={16} />
            </button>
          </aside>
        ) : (
          <aside className="hidden lg:block lg:sticky lg:top-32 self-start max-h-[calc(100vh-8rem)] overflow-y-auto bg-surface-container-low/25">
            <div className="flex items-center justify-between px-4 py-3">
              <div className="text-[10px] uppercase tracking-[0.14em] text-outline">
                {t("editorial.commentsAndReviews", "Kommentarer og vurderinger")}
              </div>
              <button
                onClick={() => setReviewsCollapsed(true)}
                className="rounded border border-outline/30 p-1 text-on-surface-variant hover:text-on-surface"
                aria-label={t("editorial.collapseReviewsPanel", "Skjul kommentarer og vurderinger")}
              >
                <PanelRightClose size={14} />
              </button>
            </div>
            <div className="space-y-5 px-4 py-4">
              <div className="space-y-2">
                <div className="text-[10px] uppercase tracking-[0.14em] text-outline">
                  {t("reader.statusNeedsReview")}
                </div>
                {pendingSegments.length === 0 ? (
                  <p className="text-xs text-on-surface-variant">{t("editorial.noPendingReviews", "Ingen avsnitt venter på godkjenning.")}</p>
                ) : (
                  <div className="space-y-2">
                    {pendingSegments.map((segment) => (
                      <div key={segment.key} className="rounded border border-outline/25 px-2.5 py-2 text-xs">
                        <div className="text-on-surface-variant">#{segment.order}</div>
                        <p className="mt-1 text-on-surface">
                          {segment.translatedText.length > 120
                            ? `${segment.translatedText.slice(0, 120)}...`
                            : segment.translatedText}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-2 border-t border-outline/20 pt-4">
                <div className="text-[10px] uppercase tracking-[0.14em] text-outline">
                  {t("editorial.versionHistory", "Versjonshistorikk")}
                </div>
                {(versionsResult?.page ?? []).length === 0 ? (
                  <p className="text-xs text-on-surface-variant">{t("editorial.noRevisions")}</p>
                ) : (
                  <div className="space-y-2">
                    {(versionsResult?.page ?? []).map((v: any) => (
                      <div key={v._id} className="rounded border border-outline/25 px-2.5 py-2 text-xs">
                        <div className="font-medium text-on-surface">v{v.version}</div>
                        <div className="text-on-surface-variant">
                          {new Intl.DateTimeFormat(i18n.language, {
                            year: "numeric",
                            month: "short",
                            day: "2-digit",
                          }).format(new Date(v.publishedAt))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </aside>
        )}
      </section>
    </main>
  );
}
