import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bookmark,
  CalendarDays,
  ChevronLeft,
  Download,
  LocateFixed,
  Minus,
  PlayCircle,
  Plus,
  Type,
} from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useTranslation } from "react-i18next";
import ParagraphBlock from "@/src/components/ParagraphBlock";
import type { ParagraphBlockSegment } from "@/src/components/ParagraphBlock";
import ParagraphCommentsModal from "@/src/components/ParagraphCommentsModal";
import VersionHistoryModal from "@/src/components/VersionHistoryModal";
import homePillarOfFire from "@/src/assets/home_pillar_of_fire.jpg";
import { formatDate } from "@/src/lib/utils";
import type { ParagraphId, SermonId } from "@/src/types/editorial";

interface ReaderPageProps {
  sermon?: any;
  onBack: () => void;
}

const fallbackSegments: ParagraphBlockSegment[] = [
  {
    key: "fb-1",
    paragraphId: null,
    order: 1,
    sourceText:
      '"Good evening, friends. It\'s a privilege to be back here again tonight in the house of the Lord."',
    translatedText:
      "Velsignet vaere Herrens Navn. Det er en stor forrett aa vaere her i kveld i Herrens hus. Vi ser frem til hva Herren vil gjore iblant oss naar vi aapner Hans Ord.",
    status: "approved",
  },
  {
    key: "fb-2",
    paragraphId: null,
    order: 2,
    sourceText:
      '"Now, we are thinking today of how that the world has come to its place where it is today."',
    translatedText:
      "Jeg vil at vi skal vende oss til Skriftene i kveld for aa finne vaart emne. Vi lever i en tid hvor mange soker etter et hvilested, et sted for fred i en urolig verden.",
    status: "needs_review",
  },
  {
    key: "fb-3",
    paragraphId: null,
    order: 3,
    sourceText:
      '"Everything is changing. Politics is changing; the world itself is changing. But God\'s Word remains the same."',
    translatedText:
      "Da Salomon bygde templet, trodde han kanskje at han hadde bygget et hus for Den Hoyeste. Men profeten sa: Hvilket hus vil dere bygge Meg? sier Herren.",
    status: "drafting",
  },
  {
    key: "fb-4",
    paragraphId: null,
    order: 4,
    sourceText:
      '"And we must find that place that God has chosen for us to rest in. Not in some man-made idea, but in Christ."',
    translatedText:
      "Vi ser i dag at folk prover aa bygge store organisasjoner, praktfulle katedraler med glassmalerier og hoye spir. De tror at Gud vil bo der.",
    status: "draft",
  },
  {
    key: "fb-5",
    paragraphId: null,
    order: 5,
    sourceText:
      '"When we look at the history of Israel, we see how they always wanted something they could see and touch."',
    translatedText:
      "Naar vi ser paa Israels historie, ser vi hvordan de alltid onsket noe de kunne se og rore ved. De ville ha en konge som nasjonene rundt dem.",
    status: "approved",
  },
  {
    key: "fb-6",
    paragraphId: null,
    order: 6,
    sourceText:
      '"In this last day, God has again sent us a message to call us out of the systems and into the true resting place."',
    translatedText:
      "I denne siste tid har Gud igjen sendt oss et budskap for aa kalle oss ut av systemene og inn i det sanne hvilestedet. Det hvilestedet er i Kristus, som er Ordet.",
    status: "approved",
  },
];

export default function ReaderPage({ sermon, onBack }: ReaderPageProps) {
  const { t, i18n } = useTranslation();
  const [mode, setMode] = useState<"read" | "proofread">("read");
  const [fontScale, setFontScale] = useState(1);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [bookmarked, setBookmarked] = useState(false);
  const [commentsParagraphId, setCommentsParagraphId] = useState<ParagraphId | null>(null);
  const [historyParagraphId, setHistoryParagraphId] = useState<ParagraphId | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const sermonId = sermon?._id as SermonId | undefined;
  const ensureParagraphs = useMutation(api.editorial.ensureParagraphsForSermon);
  const updateParagraphDraft = useMutation(api.editorial.updateParagraphDraft);
  const updateParagraphStatus = useMutation(api.editorial.updateParagraphStatus);
  const paragraphsResult = useQuery(
    api.editorial.listParagraphs,
    sermonId ? { sermonId, paginationOpts: { cursor: null, numItems: 500 } } : "skip",
  );

  const paragraphs = useMemo(() => paragraphsResult?.page ?? [], [paragraphsResult]);

  useEffect(() => {
    const onScroll = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollable <= 0) {
        setScrollProgress(0);
        return;
      }
      setScrollProgress(Math.min(100, Math.max(0, (window.scrollY / scrollable) * 100)));
    };
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!sermonId) return;
    ensureParagraphs({ sermonId }).catch((error) => {
      console.error("Failed ensuring paragraphs", error);
    });
  }, [sermonId, ensureParagraphs]);

  const segments: ParagraphBlockSegment[] = useMemo(() => {
    if (paragraphs.length > 0) {
      return paragraphs.map((p) => ({
        key: String(p._id),
        paragraphId: p._id as ParagraphId,
        order: p.order,
        sourceText: p.sourceText,
        translatedText: p.translatedText,
        status: p.status,
      }));
    }
    return fallbackSegments;
  }, [paragraphs]);

  const historySegment = useMemo(
    () => paragraphs.find((p) => p._id === historyParagraphId) ?? null,
    [historyParagraphId, paragraphs],
  );

  const sermonTitle = sermon?.title ?? "Det Valgte Hvilested";
  const sermonDate = sermon?.date ? formatDate(sermon.date, i18n.language) : "13. MAI 1965";
  const sermonSeries = sermon?.series ?? "De syv segl";

  const increaseText = () => setFontScale((prev) => Math.min(1.3, Number((prev + 0.05).toFixed(2))));
  const decreaseText = () => setFontScale((prev) => Math.max(0.85, Number((prev - 0.05).toFixed(2))));

  const startEditing = useCallback(async (segment: ParagraphBlockSegment) => {
    if (segment.status === "approved") return;
    setEditingKey(segment.key);
    setDraftText(segment.translatedText);
    if (segment.paragraphId && segment.status !== "drafting") {
      await updateParagraphStatus({ paragraphId: segment.paragraphId, status: "drafting" });
    }
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, [updateParagraphStatus]);

  const saveDraft = useCallback(async (submitForReview = false) => {
    const segment = segments.find((s) => s.key === editingKey);
    if (!segment?.paragraphId) return;
    setSaving(true);
    try {
      await updateParagraphDraft({
        paragraphId: segment.paragraphId,
        translatedText: draftText,
        reason: submitForReview
          ? "Submitted for review from reader"
          : "Draft saved from reader",
        submitForReview,
      });
      setEditingKey(null);
    } finally {
      setSaving(false);
    }
  }, [editingKey, draftText, segments, updateParagraphDraft]);

  const discardDraft = useCallback(() => {
    setEditingKey(null);
  }, []);

  return (
    <>
      <main className="min-h-screen bg-background text-on-surface">
        {/* Hero header */}
        <header className="relative flex h-125 w-full items-end overflow-hidden md:h-153.5">
          <img
            src={homePillarOfFire}
            alt="William Branham with pillar of fire"
            className="absolute inset-0 mx-auto h-full w-full max-w-250 object-cover object-top opacity-60"
          />
          <div className="absolute inset-0 bg-linear-to-t from-background via-background/60 to-background/20" />

          <div className="relative z-10 mx-auto w-full max-w-4xl px-6 pb-12 md:px-8 md:pb-16">
            <button
              onClick={onBack}
              className="mb-7 inline-flex items-center gap-2 rounded-md border border-outline/30 bg-surface-container-low/70 px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-on-surface-variant transition hover:border-primary/60 hover:text-primary"
            >
              <ChevronLeft size={14} />
              {t("common.back")}
            </button>

            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
                  {t("reader.sermonArchive")}
                </span>
                <span className="h-px w-12 bg-outline/35" />
              </div>
              <h1 className="max-w-4xl font-headline text-4xl font-bold leading-[1.1] tracking-tight text-on-surface md:text-6xl lg:text-7xl">
                {sermonTitle}
              </h1>
              <div className="flex flex-wrap items-center gap-6 pt-4 text-sm font-medium text-on-surface-variant">
                <span className="inline-flex items-center gap-2">
                  <LocateFixed size={16} className="text-primary" />
                  Jeffersonville, IN
                </span>
                <span className="inline-flex items-center gap-2">
                  <CalendarDays size={16} className="text-primary" />
                  {sermonDate}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Three-column layout */}
        <div
          className="mx-auto grid w-full gap-12 px-6 py-12 md:px-8 md:py-16 lg:grid-cols-[200px_1fr_min(20vw,350px)]"
        >
          {/* Left sidebar — progress */}
          <aside className="hidden h-fit space-y-12 lg:sticky lg:top-24 lg:block">
            <div className="space-y-4">
              <div className="text-[10px] uppercase tracking-widest text-outline">
                {t("reader.readProgress")}
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-surface-container-high">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${scrollProgress}%` }}
                />
              </div>
            </div>

            {/* Statusfordeling */}
            {(() => {
              const total = segments.length || 1;
              const approved = segments.filter((s) => s.status === "approved").length;
              const needsReview = segments.filter((s) => s.status === "needs_review").length;
              const draft = total - approved - needsReview;
              return (
                <div className="space-y-3 border-t border-outline-variant/10 pt-4">
                  <div className="text-[10px] uppercase tracking-widest text-outline">
                    {t("reader.statusBreakdown")}
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-2 text-on-surface-variant">
                        <span className="h-2 w-2 rounded-full bg-primary" />
                        {t("reader.statusApproved")}
                      </span>
                      <span className="font-bold text-primary">
                        {Math.round((approved / total) * 100)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-2 text-on-surface-variant">
                        <span className="h-2 w-2 rounded-full bg-secondary" />
                        {t("reader.statusNeedsReview")}
                      </span>
                      <span className="font-bold text-secondary">
                        {Math.round((needsReview / total) * 100)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-2 text-on-surface-variant">
                        <span className="h-2 w-2 rounded-full bg-outline-variant" />
                        {t("reader.statusDraft")}
                      </span>
                      <span className="font-bold text-outline">
                        {Math.round((draft / total) * 100)}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </aside>

          {/* Main content */}
          <article className="text-on-surface">
            {/* Sticky toolbar */}
            <div className="sticky top-18 z-40 mb-12 flex flex-wrap items-center justify-between gap-4 border-y border-outline/20 bg-background/95 py-4 backdrop-blur-sm md:mb-16">
              <div className="flex items-center gap-4">
                {/* Mode toggle */}
                <div className="flex items-center rounded-lg bg-surface-container p-1">
                  <button
                    onClick={() => setMode("read")}
                    className={`rounded-md px-3 py-1.5 text-xs font-bold tracking-widest ${
                      mode === "read"
                        ? "bg-surface-container-high text-on-surface shadow-sm"
                        : "text-on-surface-variant hover:text-on-surface"
                    }`}
                  >
                    {t("reader.readMode")}
                  </button>
                  <button
                    onClick={() => setMode("proofread")}
                    className={`rounded-md px-3 py-1.5 text-xs font-bold tracking-widest ${
                      mode === "proofread"
                        ? "bg-surface-container-high text-on-surface shadow-sm"
                        : "text-on-surface-variant hover:text-on-surface"
                    }`}
                  >
                    {t("reader.comparison")}
                  </button>
                </div>
                <div className="hidden h-6 w-px bg-outline/30 sm:block" />
                {/* Font controls */}
                <div className="inline-flex items-center gap-2 rounded-full bg-surface-container px-4 py-1.5">
                  <button
                    onClick={decreaseText}
                    className="rounded-full p-1 text-on-surface-variant transition hover:text-primary"
                    aria-label={t("reader.decreaseFont")}
                  >
                    <Minus size={16} />
                  </button>
                  <Type size={16} className="text-outline" />
                  <button
                    onClick={increaseText}
                    className="rounded-full p-1 text-on-surface-variant transition hover:text-primary"
                    aria-label={t("reader.increaseFont")}
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={sermon?.pdfUrl || "#"}
                  target={sermon?.pdfUrl ? "_blank" : undefined}
                  rel={sermon?.pdfUrl ? "noopener noreferrer" : undefined}
                  className="inline-flex items-center gap-2 rounded-md bg-surface-container px-4 py-2 text-sm font-medium transition hover:bg-surface-container-high"
                >
                  <Download size={16} />
                  {t("reader.downloadPdf")}
                </a>
                <button
                  onClick={() => setBookmarked((prev) => !prev)}
                  className="rounded-md p-2 text-on-surface-variant transition hover:text-primary"
                  aria-label={t("reader.bookmarkSermon")}
                >
                  <Bookmark size={18} fill={bookmarked ? "currentColor" : "none"} />
                </button>
              </div>
            </div>

            {/* Column headers (proofread only) */}
            {mode === "proofread" && (
              <div className="mb-8 grid grid-cols-2 gap-12 border-b border-outline-variant/20 pb-4">
                <span className="font-bold text-outline-variant">Original English</span>
                <span className="font-bold text-primary">Norsk (Bokmål)</span>
              </div>
            )}

            {/* Paragraph flow */}
            <div className="space-y-0" style={{ fontSize: `${fontScale}rem` }}>
              {segments.length === 0 ? (
                <div className="rounded-lg border border-outline/20 bg-surface-container-low p-8 text-center text-on-surface-variant">
                  {t("reader.loadingComparison")}
                </div>
              ) : (
                segments.map((segment, index) => (
                  <div key={segment.key}>
                    {/* Decorative quote block after paragraph 2 */}
                    {index === 2 && mode === "proofread" && (
                      <div className="my-12 grid grid-cols-1 gap-12 md:my-16 lg:grid-cols-2">
                        {/* Original quote */}
                        <div className="relative overflow-hidden bg-surface-container-low p-8">
                          <div className="absolute left-0 top-0 h-full w-1 bg-outline-variant/30" />
                          <blockquote className="relative z-10 font-headline text-xl italic leading-snug text-on-surface/50">
                            &ldquo;God does not rest in buildings of stone and wood, but in a heart that has
                            made room for His Word.&rdquo;
                          </blockquote>
                          <cite className="mt-6 block text-sm not-italic uppercase tracking-widest text-outline-variant">
                            – William Marrion Branham
                          </cite>
                        </div>
                        {/* Translated quote */}
                        <div className="relative overflow-hidden bg-surface-container-low p-8">
                          <div className="absolute left-0 top-0 h-full w-1 bg-secondary" />
                          <span className="pointer-events-none absolute right-8 top-4 font-headline text-8xl text-secondary/5">
                            &ldquo;
                          </span>
                          <blockquote className="relative z-10 font-headline text-2xl italic leading-snug text-secondary-fixed-dim">
                            &ldquo;Gud hviler ikke i bygninger av stein og tre, men i et hjerte som har
                            gjort rom for Hans Ord.&rdquo;
                          </blockquote>
                          <cite className="mt-6 block text-sm not-italic uppercase tracking-widest text-outline-variant">
                            – William Marrion Branham
                          </cite>
                        </div>
                      </div>
                    )}
                    {index === 2 && mode === "read" && (
                      <div className="group relative my-12 overflow-hidden bg-surface-container-low px-6 py-10 md:my-16 md:px-8 md:py-12">
                        <div className="absolute left-0 top-0 h-full w-1 bg-secondary" />
                        <span className="pointer-events-none absolute right-8 top-4 font-headline text-8xl text-secondary/5">
                          &ldquo;
                        </span>
                        <blockquote className="relative z-10 font-headline text-2xl italic leading-snug text-secondary md:text-4xl">
                          &ldquo;Gud hviler ikke i bygninger av stein og tre, men i et hjerte som har
                          gjort rom for Hans Ord.&rdquo;
                        </blockquote>
                        <cite className="mt-6 block text-sm not-italic uppercase tracking-widest text-outline-variant">
                          – William Marrion Branham
                        </cite>
                      </div>
                    )}
                    <ParagraphBlock
                      segment={segment}
                      index={index}
                      mode={mode}
                      isActiveEditing={editingKey === segment.key && mode === "proofread"}
                      onStartEditing={
                        mode === "proofread" && segment.status !== "approved"
                          ? () => startEditing(segment)
                          : undefined
                      }
                      onApprove={
                        segment.paragraphId && segment.status === "needs_review"
                          ? () => updateParagraphStatus({ paragraphId: segment.paragraphId!, status: "approved", reason: "Approved in reader" })
                          : undefined
                      }
                      onOpenComments={
                        segment.paragraphId
                          ? () => setCommentsParagraphId(segment.paragraphId)
                          : undefined
                      }
                      onOpenHistory={
                        segment.paragraphId
                          ? () => setHistoryParagraphId(segment.paragraphId)
                          : undefined
                      }
                    >
                      {editingKey === segment.key && mode === "proofread" ? (
                        <>
                          <textarea
                            ref={textareaRef}
                            className="min-h-32 w-full resize-none border-none bg-transparent p-0 font-headline text-xl leading-relaxed text-on-surface focus:outline-none focus:ring-0"
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
                              onClick={() => saveDraft(false)}
                              className="rounded border border-outline/30 bg-surface-container-highest px-5 py-2 text-xs font-bold uppercase tracking-[0.16em] text-on-surface shadow disabled:opacity-50 transition-colors hover:bg-surface-container-high"
                            >
                              {t("proofreading.saveDraft")}
                            </button>
                            <button
                              disabled={saving}
                              onClick={() => saveDraft(true)}
                              className="rounded bg-linear-to-br from-primary to-primary-container px-6 py-2 text-xs font-bold uppercase tracking-[0.16em] text-on-primary shadow-lg disabled:opacity-50"
                            >
                              {t("proofreading.submitForReview")}
                            </button>
                          </div>
                        </>
                      ) : undefined}
                    </ParagraphBlock>
                  </div>
                ))
              )}
            </div>
          </article>

          {/* Right sidebar — details */}
          <aside className="hidden min-w-0 h-fit lg:sticky lg:top-24 lg:block">
            <div className="overflow-hidden rounded-lg border border-outline/15 bg-surface-container-low p-6">
              <h3 className="mb-4 font-headline text-lg text-secondary">
                {t("reader.details")}
              </h3>
              <dl className="space-y-4 text-sm">
                <div>
                  <dt className="mb-1 text-[10px] uppercase tracking-wider text-outline">
                    {t("reader.series")}
                  </dt>
                  <dd className="text-on-surface">{sermonSeries}</dd>
                </div>
                <div>
                  <dt className="mb-1 text-[10px] uppercase tracking-wider text-outline">
                    {t("reader.audioFile")}
                  </dt>
                  <dd className="min-w-0">
                    <a
                      href={sermon?.audioUrl || "#"}
                      target={sermon?.audioUrl ? "_blank" : undefined}
                      rel={sermon?.audioUrl ? "noopener noreferrer" : undefined}
                      className="flex min-w-0 items-center gap-2 text-primary transition hover:text-primary/80"
                    >
                      <PlayCircle size={16} className="shrink-0" />
                      <span className="truncate">{sermon?._id || "65-0513"}</span>
                    </a>
                  </dd>
                </div>
                <div>
                  <dt className="mb-1 text-[10px] uppercase tracking-wider text-outline">
                    {t("reader.translationLanguage")}
                  </dt>
                  <dd className="text-on-surface">
                    {i18n.language === "nb" ? "Norsk (Bokmål)" : "Norwegian (Bokmål)"}
                  </dd>
                </div>
              </dl>
            </div>
          </aside>
        </div>

        {/* Prev / Next navigation */}
        <div className="mx-auto mt-2 w-full max-w-4xl border-t border-outline/20 px-6 py-12 md:px-8">
          <div className="flex flex-col items-center justify-between gap-8 sm:flex-row">
            <button
              onClick={onBack}
              className="group flex flex-col items-center gap-2 text-center sm:items-start sm:text-left"
            >
              <span className="text-xs uppercase tracking-[0.16em] text-outline transition group-hover:text-primary">
                {t("reader.previousSermon")}
              </span>
              <span className="font-headline text-lg text-on-surface md:text-xl">
                Det ellevte bud
              </span>
            </button>
            <button
              onClick={onBack}
              className="group flex flex-col items-center gap-2 text-center sm:items-end sm:text-right"
            >
              <span className="text-xs uppercase tracking-[0.16em] text-outline transition group-hover:text-primary">
                {t("reader.nextSermon")}
              </span>
              <span className="font-headline text-lg text-on-surface md:text-xl">
                Kraften av forvandling
              </span>
            </button>
          </div>
        </div>

        {/* Inline footer */}
        <footer className="border-t border-outline-variant/15 bg-surface-container-low py-12">
          <div className="mx-auto grid w-full max-w-screen-2xl grid-cols-1 gap-8 px-6 md:grid-cols-2 md:px-12">
            <div className="space-y-2 text-center md:text-left">
              <div className="text-lg font-headline italic text-secondary">
                {t("footer.digitalArchive")}
              </div>
              <p className="text-[10px] uppercase tracking-[0.05em] text-outline">
                {t("footer.copyright")}
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-6 md:justify-end">
              <a className="text-[10px] uppercase tracking-[0.05em] text-outline transition hover:text-on-surface" href="#">
                {t("footer.archiveGuidelines")}
              </a>
              <a className="text-[10px] uppercase tracking-[0.05em] text-outline transition hover:text-on-surface" href="#">
                {t("footer.privacyPolicy")}
              </a>
              <a className="text-[10px] uppercase tracking-[0.05em] text-outline transition hover:text-on-surface" href="#">
                {t("footer.termsOfService")}
              </a>
            </div>
          </div>
        </footer>
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
