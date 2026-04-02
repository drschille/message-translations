import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Bookmark,
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
  NotebookPen,
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
import {
  deletePrivateHighlight,
  exportPrivateAnnotations,
  getPrivateToolbarPrefs,
  importPrivateAnnotations,
  listPrivateHighlights,
  setPrivateToolbarPrefs,
  upsertPrivateHighlight,
} from "@/src/lib/readerPrivateAnnotations";

type ColumnMode = "one" | "two";
type HighlightColor = "yellow" | "blue" | "green" | "red";

type Segment = {
  key: string;
  paragraphId: ParagraphId | null;
  order: number;
  sourceText: string;
  translatedText: string;
  status: "draft" | "drafting" | "needs_review" | "approved";
};

type HighlightEntry = {
  _id: string;
  paragraphId: ParagraphId;
  color: HighlightColor;
  startOffset: number;
  endOffset: number;
  selectedText: string;
};

type SelectionInfo = {
  segmentKey: string;
  paragraphId: ParagraphId;
  startOffset: number;
  endOffset: number;
  selectedText: string;
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

function highlightBgClass(color: HighlightColor) {
  if (color === "yellow") return "bg-yellow-300/35";
  if (color === "blue") return "bg-blue-300/30";
  if (color === "green") return "bg-emerald-300/30";
  return "bg-red-300/30";
}

function renderHighlightedText(text: string, highlights: HighlightEntry[]) {
  if (highlights.length === 0) return [<span key="plain">{text}</span>];

  const sorted = highlights
    .filter((h) => h.startOffset >= 0 && h.endOffset > h.startOffset && h.endOffset <= text.length)
    .sort((a, b) => a.startOffset - b.startOffset || a.endOffset - b.endOffset);
  const merged: HighlightEntry[] = [];

  for (const h of sorted) {
    const last = merged[merged.length - 1];
    if (!last || h.startOffset >= last.endOffset) {
      merged.push(h);
      continue;
    }
    if (h.endOffset > last.endOffset) {
      merged[merged.length - 1] = { ...last, endOffset: h.endOffset };
    }
  }

  const out: ReactNode[] = [];
  let cursor = 0;
  for (let i = 0; i < merged.length; i += 1) {
    const h = merged[i];
    if (h.startOffset > cursor) {
      out.push(<span key={`t-${i}`}>{text.slice(cursor, h.startOffset)}</span>);
    }
    out.push(
      <mark key={`h-${i}`} className={`${highlightBgClass(h.color)} rounded-[2px] px-[1px] text-inherit`}>
        {text.slice(h.startOffset, h.endOffset)}
      </mark>,
    );
    cursor = h.endOffset;
  }
  if (cursor < text.length) out.push(<span key="t-last">{text.slice(cursor)}</span>);
  return out;
}

function useAutoGrowTranslatedTextareas(deps: ReadonlyArray<unknown>) {
  const autoResizeTranslatedTextarea = useCallback((textarea: HTMLTextAreaElement | null) => {
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${textarea.scrollHeight}px`;
    textarea.scrollTop = 0;
  }, []);

  useLayoutEffect(() => {
    const textareas = document.querySelectorAll<HTMLTextAreaElement>("[data-editor-autogrow='translated']");
    textareas.forEach((textarea) => autoResizeTranslatedTextarea(textarea));
  }, [autoResizeTranslatedTextarea, ...deps]);

  return autoResizeTranslatedTextarea;
}

export default function EditorReaderPage() {
  const { t, i18n } = useTranslation();
  const { sermonId: sermonIdParam } = useParams();
  const navigate = useNavigate();
  const sermonId = sermonIdParam as SermonId | undefined;
  const languageCode = normalizeLanguageCode(i18n.language);

  const [columnMode, setColumnMode] = useState<ColumnMode>("one");
  const [compareOpen, setCompareOpen] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busyKeys, setBusyKeys] = useState<Record<string, boolean>>({});
  const [reviewsCollapsed, setReviewsCollapsed] = useState(true);
  const [suppressBlurSaveKey, setSuppressBlurSaveKey] = useState<string | null>(null);
  const [fontSizePx, setFontSizePx] = useState(16);
  const [bookmarked, setBookmarked] = useState(false);
  const [activeSelection, setActiveSelection] = useState<SelectionInfo | null>(null);
  const [selectedHighlightColor, setSelectedHighlightColor] = useState<HighlightColor | null>(null);
  const [localHighlights, setLocalHighlights] = useState<HighlightEntry[]>([]);
  const importInputRef = useRef<HTMLInputElement | null>(null);

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
  const revertBaselinesResult = useQuery(
    api.editorial.listRevertBaselines as any,
    sermonId ? { sermonId, languageCode } : "skip",
  );
  const ensureParagraphs = useMutation(api.editorial.ensureParagraphsForSermon);
  const updateParagraphDraft = useMutation(api.editorial.updateParagraphDraft);
  const updateParagraphStatus = useMutation(api.editorial.updateParagraphStatus);
  const revertParagraphToLastApproved = useMutation(api.editorial.revertParagraphToLastApproved as any);

  useEffect(() => {
    if (!sermonId) return;
    ensureParagraphs({ sermonId, languageCode }).catch((error) => {
      console.error("Failed ensuring paragraphs", error);
    });
  }, [sermonId, ensureParagraphs, languageCode]);

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

  useEffect(() => {
    if (!sermonId) return;
    let cancelled = false;
    Promise.all([
      getPrivateToolbarPrefs({ sermonId, languageCode }),
      listPrivateHighlights({ sermonId, languageCode }),
    ])
      .then(([prefs, highlights]) => {
        if (cancelled) return;
        if (prefs) {
          setFontSizePx(prefs.fontSizePx);
          setBookmarked(prefs.bookmarked);
        }
        setLocalHighlights(
          highlights.map((h) => ({
            _id: h.id,
            paragraphId: h.paragraphId as ParagraphId,
            color: h.color,
            startOffset: h.startOffset,
            endOffset: h.endOffset,
            selectedText: h.selectedText,
          })),
        );
      })
      .catch((error) => {
        console.error("Failed loading local annotations", error);
      });
    return () => {
      cancelled = true;
    };
  }, [sermonId, languageCode]);

  const highlights: HighlightEntry[] = useMemo(() => localHighlights, [localHighlights]);

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

  const revertBaselineByParagraphId = useMemo(() => {
    const map = new Map<string, string>();
    for (const baseline of revertBaselinesResult ?? []) {
      map.set(String(baseline.paragraphId), baseline.targetText);
    }
    return map;
  }, [revertBaselinesResult]);

  const paragraphHighlightColors = useMemo(() => {
    const map = new Map<string, HighlightColor[]>();
    for (const highlight of highlights) {
      const key = String(highlight.paragraphId);
      const existing = map.get(key) ?? [];
      if (!existing.includes(highlight.color)) {
        existing.push(highlight.color);
      }
      map.set(key, existing);
    }
    return map;
  }, [highlights]);

  const setBusy = (key: string, busy: boolean) => {
    setBusyKeys((prev) => ({ ...prev, [key]: busy }));
  };

  const persistToolbarPrefs = useCallback(
    async (next: { fontSizePx?: number; bookmarked?: boolean }) => {
      if (!sermonId) return;
      try {
        await setPrivateToolbarPrefs({
          sermonId,
          languageCode,
          fontSizePx: next.fontSizePx ?? fontSizePx,
          bookmarked: next.bookmarked ?? bookmarked,
        });
      } catch (error) {
        console.error("Failed persisting local toolbar prefs", error);
      }
    },
    [sermonId, languageCode, fontSizePx, bookmarked],
  );

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

  const approveIfClean = useCallback(
    async (segment: Segment) => {
      const currentText = (drafts[segment.key] ?? segment.translatedText).trim();
      const baselineText = segment.translatedText.trim();
      const hasLocalEdits = currentText !== baselineText;

      // Edits after requesting approval must be re-submitted for approval.
      if (hasLocalEdits) {
        await saveDraft(segment, false);
        return;
      }

      await approve(segment);
    },
    [approve, drafts, saveDraft],
  );

  const revertToLastApproved = useCallback(
    async (segment: Segment) => {
      if (!segment.paragraphId) return;
      setBusy(segment.key, true);
      try {
        const result = await revertParagraphToLastApproved({
          paragraphId: segment.paragraphId,
          languageCode,
          reason: "Reverted to last approved translation from editor proofreader",
        });
        if (result?.translatedText) {
          setDrafts((prev) => ({ ...prev, [segment.key]: result.translatedText as string }));
        }
      } finally {
        setBusy(segment.key, false);
      }
    },
    [revertParagraphToLastApproved, languageCode],
  );

  const captureSelection = (segment: Segment, element: HTMLTextAreaElement) => {
    if (!segment.paragraphId) {
      setActiveSelection(null);
      return;
    }
    const start = element.selectionStart ?? 0;
    const end = element.selectionEnd ?? 0;
    if (end <= start) {
      setActiveSelection(null);
      return;
    }
    const selectedText = element.value.slice(start, end);
    if (!selectedText.trim()) {
      setActiveSelection(null);
      return;
    }
    setActiveSelection({
      segmentKey: segment.key,
      paragraphId: segment.paragraphId,
      startOffset: start,
      endOffset: end,
      selectedText,
    });
  };

  const autoResizeTranslatedTextarea = useAutoGrowTranslatedTextareas([
    drafts,
    fontSizePx,
    columnMode,
    segments.length,
  ]);

  const applyHighlight = async (color: HighlightColor) => {
    if (!sermonId) return;
    setSelectedHighlightColor(color);
    if (!activeSelection) return;

    const existing = highlights.find(
      (h) =>
        h.paragraphId === activeSelection.paragraphId &&
        h.startOffset === activeSelection.startOffset &&
        h.endOffset === activeSelection.endOffset,
    );

    if (existing && existing.color === color) {
      try {
        await deletePrivateHighlight(existing._id);
        setLocalHighlights((prev) => prev.filter((h) => h._id !== existing._id));
      } catch (error) {
        console.error("Failed removing local highlight", error);
      }
      return;
    }

    if (existing && existing.color !== color) {
      try {
        await deletePrivateHighlight(existing._id);
        setLocalHighlights((prev) => prev.filter((h) => h._id !== existing._id));
      } catch (error) {
        console.error("Failed replacing local highlight", error);
      }
    }

    try {
      const saved = await upsertPrivateHighlight({
        sermonId,
        paragraphId: activeSelection.paragraphId,
        languageCode,
        color,
        startOffset: activeSelection.startOffset,
        endOffset: activeSelection.endOffset,
        selectedText: activeSelection.selectedText,
      });
      setLocalHighlights((prev) => [
        ...prev.filter((h) => h._id !== saved.id),
        {
          _id: saved.id,
          paragraphId: saved.paragraphId as ParagraphId,
          color: saved.color,
          startOffset: saved.startOffset,
          endOffset: saved.endOffset,
          selectedText: saved.selectedText,
        },
      ]);
    } catch (error) {
      console.error("Failed creating local highlight", error);
      setLocalHighlights((prev) => [
        ...prev,
        {
          _id: `local-${activeSelection.paragraphId}-${activeSelection.startOffset}-${activeSelection.endOffset}-${color}`,
          paragraphId: activeSelection.paragraphId,
          color,
          startOffset: activeSelection.startOffset,
          endOffset: activeSelection.endOffset,
          selectedText: activeSelection.selectedText,
        },
      ]);
    }
  };

  const adjustFontSize = (delta: number) => {
    const next = Math.max(12, Math.min(30, fontSizePx + delta));
    setFontSizePx(next);
    persistToolbarPrefs({ fontSizePx: next });
  };

  const toggleBookmark = () => {
    const next = !bookmarked;
    setBookmarked(next);
    persistToolbarPrefs({ bookmarked: next });
  };

  const handleExportAnnotations = useCallback(async () => {
    if (!sermonId) return;
    try {
      const payload = await exportPrivateAnnotations({ sermonId, languageCode });
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `sermon-${sermonId}-${languageCode}-annotations.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed exporting annotations", error);
    }
  }, [sermonId, languageCode]);

  const handleImportFile = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      if (!sermonId) return;
      const file = event.target.files?.[0];
      event.currentTarget.value = "";
      if (!file) return;
      try {
        const text = await file.text();
        await importPrivateAnnotations({
          sermonId,
          languageCode,
          jsonText: text,
          strategy: "merge",
        });
        const [prefs, highlights] = await Promise.all([
          getPrivateToolbarPrefs({ sermonId, languageCode }),
          listPrivateHighlights({ sermonId, languageCode }),
        ]);
        if (prefs) {
          setFontSizePx(prefs.fontSizePx);
          setBookmarked(prefs.bookmarked);
        }
        setLocalHighlights(
          highlights.map((h) => ({
            _id: h.id,
            paragraphId: h.paragraphId as ParagraphId,
            color: h.color,
            startOffset: h.startOffset,
            endOffset: h.endOffset,
            selectedText: h.selectedText,
          })),
        );
      } catch (error) {
        console.error("Failed importing annotations", error);
      }
    },
    [sermonId, languageCode],
  );

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

      <section className="sticky top-16 z-40 border-b border-outline/20 bg-[#1c1b1b]/95 backdrop-blur-sm">
        <div className="px-6 md:px-8 py-3 flex items-center justify-between gap-4 flex-wrap">
          <button
            onClick={() => navigate("/editor/sermons")}
            className="inline-flex items-center gap-2 text-[13px] font-medium text-on-surface-variant hover:text-on-surface"
          >
            <ChevronLeft size={18} />
            {t("proofreading.backToArchive")}
          </button>

          <div className="rounded-lg bg-surface-container p-1 inline-flex gap-1">
            <button
              onClick={() => setColumnMode("one")}
              className={`inline-flex items-center gap-1.5 rounded-md px-5 py-2 text-[13px] font-medium ${
                columnMode === "one"
                  ? "bg-primary text-[#093255]"
                  : "bg-surface-container text-on-surface-variant"
              }`}
            >
              {t("proofreading.mode.one")}
            </button>
            <button
              onClick={() => setColumnMode("two")}
              className={`inline-flex items-center gap-1.5 rounded-md px-5 py-2 text-[13px] font-medium ${
                columnMode === "two"
                  ? "bg-primary text-[#093255]"
                  : "bg-surface-container text-on-surface-variant"
              }`}
            >
              {t("proofreading.mode.two")}
            </button>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              {([
                ["yellow", "#facc15"],
                ["blue", "#60a5fa"],
                ["green", "#4ade80"],
                ["red", "#f87171"],
              ] as const).map(([color, fill]) => (
                <motion.button
                  key={color}
                  onClick={() => applyHighlight(color)}
                  className={`h-[18px] w-[18px] rounded-full ${selectedHighlightColor === color ? "ring-2 ring-[#e5e2e1]" : ""}`}
                  style={{ backgroundColor: fill }}
                  aria-label={t("editorial.highlightColor", { color })}
                  whileTap={{ scale: 0.9 }}
                  animate={{ scale: selectedHighlightColor === color ? 1.08 : 1 }}
                  transition={{ type: "spring", stiffness: 450, damping: 24 }}
                />
              ))}
            </div>

            <div className="h-5 w-px bg-[#43474e]" />

            <button
              onClick={() => setReviewsCollapsed((prev) => !prev)}
              className="inline-flex items-center gap-1.5 rounded-md border border-[#43474e] px-3 py-1.5 text-xs text-on-surface-variant hover:text-on-surface"
            >
              <NotebookPen size={16} />
              <span>{t("editorial.notes")}</span>
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[#093255] text-[10px] font-semibold">
                {pendingSegments.length}
              </span>
            </button>

            <button
              onClick={toggleBookmark}
              className={`text-on-surface-variant ${bookmarked ? "text-primary" : ""}`}
              aria-label={t("reader.bookmarkSermon")}
            >
              <Bookmark size={18} fill={bookmarked ? "currentColor" : "none"} />
            </button>

            <button
              onClick={handleExportAnnotations}
              className="rounded border border-[#43474e] px-2.5 py-1.5 text-[11px] text-on-surface-variant hover:text-on-surface"
            >
              {t("reader.exportAnnotations")}
            </button>
            <button
              onClick={() => importInputRef.current?.click()}
              className="rounded border border-[#43474e] px-2.5 py-1.5 text-[11px] text-on-surface-variant hover:text-on-surface"
            >
              {t("reader.importAnnotations")}
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json"
              onChange={handleImportFile}
              className="hidden"
            />

            <div className="h-5 w-px bg-[#43474e]" />

            <button
              onClick={() => adjustFontSize(-1)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#43474e] text-xs text-on-surface-variant"
            >
              A-
            </button>
            <span className="text-[13px] text-on-surface">{fontSizePx}px</span>
            <button
              onClick={() => adjustFontSize(1)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#43474e] text-xs text-on-surface-variant"
            >
              A+
            </button>
          </div>
        </div>
      </section>

      <section
        className={`grid gap-0 transition-[grid-template-columns] duration-300 ease-out ${
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
                <span className="text-outline">{t("editorial.originalColumnLabel")}</span>
                <span className="text-on-surface-variant">{t("editorial.translationColumnLabel")}</span>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-4">
                <span className="text-on-surface-variant">{t("editorial.singleColumnTranslationLabel")}</span>
                <span className="text-outline">{t("proofreading.singleColumnHint")}</span>
              </div>
            )}
          </div>

          {segments.map((segment, index) => {
            const state = statusMeta(segment.status, t);
            const compareIsOpen = compareOpen[segment.key] ?? false;
            const currentText = drafts[segment.key] ?? segment.translatedText;
            const dirty = currentText.trim() !== segment.translatedText.trim();
            const lockedApproved = segment.status === "approved";
            const saving = !!busyKeys[segment.key];
            const revertTargetText =
              segment.paragraphId
                ? (revertBaselineByParagraphId.get(String(segment.paragraphId)) ?? segment.translatedText)
                : segment.translatedText;
            const canRevert = !!segment.paragraphId && currentText !== revertTargetText;
            const colors = segment.paragraphId ? (paragraphHighlightColors.get(String(segment.paragraphId)) ?? []) : [];

            return (
              <div
                key={segment.key}
                className={`border-b border-outline/20 ${rowTone(index)} px-8 py-5`}
              >
                {columnMode === "two" ? (
                  <div className="grid grid-cols-[auto_1fr_1fr] gap-6">
                    <div className="pt-1 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {colors.length > 0 && (
                          <div className="flex items-center justify-end gap-1">
                            {colors.map((c) => (
                              <span
                                key={c}
                                className="h-2 w-2 rounded-full"
                                style={{
                                  backgroundColor:
                                    c === "yellow" ? "#facc15" : c === "blue" ? "#60a5fa" : c === "green" ? "#4ade80" : "#f87171",
                                }}
                              />
                            ))}
                          </div>
                        )}
                        <div className="text-[11px] text-outline/70">{segment.order}</div>
                      </div>
                      <div className="mt-1 inline-flex items-center justify-end gap-1.5 text-[10px] uppercase tracking-[0.12em] text-on-surface-variant">
                        {state.icon}
                        <span>{state.label}</span>
                      </div>
                    </div>
                    <div className="pr-4 border-r border-outline/25">
                      <p className="italic text-on-surface-variant leading-relaxed" style={{ fontSize: `${fontSizePx}px` }}>
                        {segment.sourceText}
                      </p>
                    </div>
                    <div className="space-y-3 pl-2">
                      <div className="relative">
                        <div
                          className="pointer-events-none absolute inset-0 whitespace-pre-wrap break-words text-on-surface leading-relaxed"
                          style={{ fontSize: `${fontSizePx}px` }}
                        >
                          {renderHighlightedText(
                            currentText,
                            highlights.filter((h) => h.paragraphId === segment.paragraphId),
                          )}
                        </div>
                        <textarea
                          id={`editor-reader-translated-text-two-column-${segment.order}`}
                          data-editor-autogrow="translated"
                          value={currentText}
                          readOnly={lockedApproved || saving}
                          onSelect={(e) => captureSelection(segment, e.currentTarget)}
                          onKeyUp={(e) => captureSelection(segment, e.currentTarget)}
                          onMouseUp={(e) => captureSelection(segment, e.currentTarget)}
                          onInput={(e) => autoResizeTranslatedTextarea(e.currentTarget)}
                          onChange={(e) => setDrafts((prev) => ({ ...prev, [segment.key]: e.target.value }))}
                          onBlur={() => {
                            if (suppressBlurSaveKey === segment.key) {
                              setSuppressBlurSaveKey(null);
                              return;
                            }
                            if (!lockedApproved && dirty) {
                              saveDraft(segment, false).catch((e) => console.error(e));
                            }
                          }}
                          className={`relative z-10 block w-full min-h-20 resize-none overflow-hidden bg-transparent rounded px-0 py-0 text-transparent caret-on-surface leading-relaxed ${
                            lockedApproved ? "opacity-95" : "focus:outline-none focus:ring-0"
                          }`}
                          style={{ fontSize: `${fontSizePx}px`, overflowY: "hidden" }}
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {segment.status === "approved" && (
                          <button
                            onClick={() => ensureDrafting(segment)}
                            disabled={saving}
                            className="rounded border border-outline/30 px-2.5 py-1 text-on-surface-variant hover:text-on-surface"
                          >
                            {t("editorial.edit")}
                          </button>
                        )}
                        {(segment.status === "draft" || segment.status === "drafting") && (
                          <>
                            <button
                              onClick={() => saveDraft(segment, true)}
                              disabled={saving}
                              className="rounded border border-outline/30 px-2.5 py-1 text-on-surface-variant hover:text-on-surface"
                            >
                              {t("proofreading.requestApproval")}
                            </button>
                            {canRevert && (
                              <button
                                onMouseDown={() => setSuppressBlurSaveKey(segment.key)}
                                onClick={() => revertToLastApproved(segment)}
                                disabled={saving}
                                className="rounded border border-outline/30 px-2.5 py-1 text-on-surface-variant disabled:opacity-45"
                              >
                                {t("proofreading.revertDraftChanges")}
                              </button>
                            )}
                          </>
                        )}
                        {segment.status === "needs_review" && (
                          <button
                            onClick={() => approveIfClean(segment)}
                            disabled={saving}
                            className="rounded border border-outline/30 px-2.5 py-1 text-on-surface-variant hover:text-on-surface"
                          >
                            {t("proofreading.approveSegment")}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-4 md:grid-cols-[96px_minmax(0,1fr)_auto]">
                    <div className="flex flex-col items-end gap-1 pt-1 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {colors.length > 0 && (
                          <div className="flex items-center justify-end gap-1">
                            {colors.map((c) => (
                              <span
                                key={c}
                                className="h-2 w-2 rounded-full"
                                style={{
                                  backgroundColor:
                                    c === "yellow" ? "#facc15" : c === "blue" ? "#60a5fa" : c === "green" ? "#4ade80" : "#f87171",
                                }}
                              />
                            ))}
                          </div>
                        )}
                        <div className="text-[11px] text-outline/70">{segment.order}</div>
                      </div>
                      <div className="flex items-center justify-end gap-1.5 text-[10px] uppercase tracking-[0.12em] text-on-surface-variant">
                        {state.icon}
                        <span>{state.label}</span>
                      </div>
                    </div>

                    <div className="min-w-0 space-y-3">
                      <AnimatePresence initial={false}>
                        {compareIsOpen && (
                          <motion.div
                            key={`compare-${segment.key}`}
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.22, ease: "easeOut" }}
                            className="overflow-hidden"
                          >
                            <div className="space-y-2 pb-1">
                              <div className="text-[10px] uppercase tracking-[0.14em] text-outline">
                                {t("reader.original")}
                              </div>
                              <p className="italic text-on-surface-variant leading-relaxed" style={{ fontSize: `${fontSizePx}px` }}>
                                {segment.sourceText}
                              </p>
                              <div className="h-px bg-outline/35" />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <div className="relative">
                        <div
                          className="pointer-events-none absolute inset-0 whitespace-pre-wrap break-words text-on-surface leading-relaxed"
                          style={{ fontSize: `${fontSizePx}px` }}
                        >
                          {renderHighlightedText(
                            currentText,
                            highlights.filter((h) => h.paragraphId === segment.paragraphId),
                          )}
                        </div>
                        <textarea
                          id={`editor-reader-translated-text-single-column-${segment.order}`}
                          data-editor-autogrow="translated"
                          value={currentText}
                          readOnly={lockedApproved || saving}
                          onSelect={(e) => captureSelection(segment, e.currentTarget)}
                          onKeyUp={(e) => captureSelection(segment, e.currentTarget)}
                          onMouseUp={(e) => captureSelection(segment, e.currentTarget)}
                          onInput={(e) => autoResizeTranslatedTextarea(e.currentTarget)}
                          onChange={(e) => setDrafts((prev) => ({ ...prev, [segment.key]: e.target.value }))}
                          onBlur={() => {
                            if (suppressBlurSaveKey === segment.key) {
                              setSuppressBlurSaveKey(null);
                              return;
                            }
                            if (!lockedApproved && dirty) {
                              saveDraft(segment, false).catch((e) => console.error(e));
                            }
                          }}
                          className={`relative z-10 block w-full min-h-20 resize-none overflow-hidden bg-transparent rounded px-0 py-0 text-transparent caret-on-surface leading-relaxed ${
                            lockedApproved ? "opacity-95" : "focus:outline-none focus:ring-0"
                          }`}
                          style={{ fontSize: `${fontSizePx}px`, overflowY: "hidden" }}
                        />
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2 md:min-w-56">
                      <button
                        onClick={() => setCompareOpen((prev) => ({ ...prev, [segment.key]: !compareIsOpen }))}
                        className="inline-flex items-center gap-1 rounded border border-outline/30 px-2 py-1 text-[11px] text-on-surface-variant"
                      >
                        {compareIsOpen ? t("editorial.hideCompare") : t("editorial.compare")}
                        {compareIsOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </button>

                      <div className="flex flex-wrap justify-end gap-2 text-xs">
                        {segment.status === "approved" && (
                          <button
                            onClick={() => ensureDrafting(segment)}
                            disabled={saving}
                            className="rounded border border-outline/30 px-2.5 py-1 text-on-surface-variant hover:text-on-surface"
                          >
                            {t("editorial.edit")}
                          </button>
                        )}
                        {(segment.status === "draft" || segment.status === "drafting") && (
                          <div className="flex flex-col items-end gap-2">
                            <button
                              onClick={() => saveDraft(segment, true)}
                              disabled={saving}
                              className="rounded border border-outline/30 px-2.5 py-1 text-on-surface-variant hover:text-on-surface"
                            >
                              {t("proofreading.requestApproval")}
                            </button>
                            {canRevert && (
                              <button
                                onMouseDown={() => setSuppressBlurSaveKey(segment.key)}
                                onClick={() => revertToLastApproved(segment)}
                                disabled={saving}
                                className="rounded border border-outline/30 px-2.5 py-1 text-on-surface-variant disabled:opacity-45"
                              >
                                {t("proofreading.revertDraftChanges")}
                              </button>
                            )}
                          </div>
                        )}
                        {segment.status === "needs_review" && (
                          <button
                            onClick={() => approveIfClean(segment)}
                            disabled={saving}
                            className="rounded border border-outline/30 px-2.5 py-1 text-on-surface-variant hover:text-on-surface"
                          >
                            <Check size={12} className="mr-1 inline" />
                            {t("proofreading.approveSegment")}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </article>

        <AnimatePresence mode="wait" initial={false}>
          {reviewsCollapsed ? (
            <motion.aside
              key="reviews-collapsed"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="hidden lg:flex lg:sticky lg:top-32 self-start bg-surface-container-low/35 items-start justify-center pt-8"
            >
              <button
                onClick={() => setReviewsCollapsed(false)}
                className="inline-flex flex-col items-center gap-2 text-on-surface-variant hover:text-on-surface"
                aria-label={t("editorial.expandReviewsPanel")}
              >
                <MessageSquareText size={18} />
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/25 px-1.5 text-[10px] text-primary">
                  {pendingSegments.length}
                </span>
                <PanelRightOpen size={16} />
              </button>
            </motion.aside>
          ) : (
            <motion.aside
              key="reviews-expanded"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.24, ease: "easeOut" }}
              className="hidden lg:block lg:sticky lg:top-32 self-start max-h-[calc(100vh-8rem)] overflow-y-auto bg-surface-container-low/25"
            >
              <div className="flex items-center justify-between px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.14em] text-outline">
                  {t("editorial.commentsAndReviews")}
                </div>
                <button
                  onClick={() => setReviewsCollapsed(true)}
                  className="rounded border border-outline/30 p-1 text-on-surface-variant hover:text-on-surface"
                  aria-label={t("editorial.collapseReviewsPanel")}
                >
                  <PanelRightClose size={14} />
                </button>
              </div>
              <div className="space-y-5 px-4 py-4">
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="space-y-2"
                >
                  <div className="text-[10px] uppercase tracking-[0.14em] text-outline">
                    {t("reader.statusNeedsReview")}
                  </div>
                  {pendingSegments.length === 0 ? (
                    <p className="text-xs text-on-surface-variant">{t("editorial.noPendingReviews")}</p>
                  ) : (
                    <div className="space-y-2">
                      <AnimatePresence initial={false}>
                        {pendingSegments.map((segment) => (
                          <motion.div
                            key={segment.key}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.18, ease: "easeOut" }}
                            className="rounded border border-outline/25 px-2.5 py-2 text-xs"
                          >
                            <div className="text-on-surface-variant">#{segment.order}</div>
                            <p className="mt-1 text-on-surface">
                              {segment.translatedText.length > 120
                                ? `${segment.translatedText.slice(0, 120)}...`
                                : segment.translatedText}
                            </p>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, delay: 0.04, ease: "easeOut" }}
                  className="space-y-2 border-t border-outline/20 pt-4"
                >
                  <div className="text-[10px] uppercase tracking-[0.14em] text-outline">
                    {t("editorial.versionHistory")}
                  </div>
                  {(versionsResult?.page ?? []).length === 0 ? (
                    <p className="text-xs text-on-surface-variant">{t("editorial.noRevisions")}</p>
                  ) : (
                    <div className="space-y-2">
                      {(versionsResult?.page ?? []).map((v: any) => (
                        <motion.div
                          key={v._id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.18, ease: "easeOut" }}
                          className="rounded border border-outline/25 px-2.5 py-2 text-xs"
                        >
                          <div className="font-medium text-on-surface">v{v.version}</div>
                          <div className="text-on-surface-variant">
                            {new Intl.DateTimeFormat(i18n.language, {
                              year: "numeric",
                              month: "short",
                              day: "2-digit",
                            }).format(new Date(v.publishedAt))}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </motion.div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </section>
    </main>
  );
}
