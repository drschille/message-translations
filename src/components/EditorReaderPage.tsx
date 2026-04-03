import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
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
  Eraser,
  MessageSquareText,
  NotebookPen,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  RotateCcw,
  Send,
  Square,
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

function rangesOverlap(startA: number, endA: number, startB: number, endB: number) {
  return startA < endB && endA > startB;
}

function ProofreaderShimmerRows({ columnMode }: { columnMode: ColumnMode }) {
  const rows = [1, 2, 3];
  return (
    <div>
      {rows.map((row) => (
        <div key={row} className={`border-b border-outline/20 ${rowTone(row)} px-8 py-5 animate-pulse`}>
          {columnMode === "two" ? (
            <div className="grid grid-cols-[auto_1fr_1fr] gap-6">
              <div className="pt-1 text-right space-y-2">
                <div className="h-3 w-6 rounded bg-surface-container-high ml-auto" />
                <div className="h-3 w-16 rounded bg-surface-container-high ml-auto" />
              </div>
              <div className="pr-4 border-r border-outline/25 space-y-2">
                <div className="h-3 w-full rounded bg-surface-container-high" />
                <div className="h-3 w-5/6 rounded bg-surface-container-high" />
                <div className="h-3 w-4/5 rounded bg-surface-container-high" />
              </div>
              <div className="pl-2 space-y-3">
                <div className="space-y-2">
                  <div className="h-3 w-full rounded bg-surface-container-high" />
                  <div className="h-3 w-[92%] rounded bg-surface-container-high" />
                  <div className="h-3 w-4/5 rounded bg-surface-container-high" />
                </div>
                <div className="flex gap-2">
                  <div className="h-7 w-24 rounded bg-surface-container-high" />
                  <div className="h-7 w-24 rounded bg-surface-container-high" />
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-4 md:grid-cols-[96px_minmax(0,1fr)_auto]">
              <div className="pt-1 text-right space-y-2">
                <div className="h-3 w-6 rounded bg-surface-container-high ml-auto" />
                <div className="h-3 w-16 rounded bg-surface-container-high ml-auto" />
              </div>
              <div className="space-y-3">
                <div className="space-y-2">
                  <div className="h-3 w-full rounded bg-surface-container-high" />
                  <div className="h-3 w-[92%] rounded bg-surface-container-high" />
                  <div className="h-3 w-4/5 rounded bg-surface-container-high" />
                </div>
                <div className="h-8 w-full rounded bg-surface-container-high/80" />
              </div>
              <div className="hidden md:flex flex-col items-end gap-2">
                <div className="h-7 w-28 rounded bg-surface-container-high" />
                <div className="h-7 w-24 rounded bg-surface-container-high" />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

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

function renderTextWithLineBreakSpacing(text: string) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  return (
    <span className="block space-y-2">
      {lines.map((line, index) => (
        <span key={index} className="block break-words">
          {line.length > 0 ? line : "\u00A0"}
        </span>
      ))}
    </span>
  );
}

function mergeHighlights(text: string, highlights: HighlightEntry[]) {
  return highlights
    .filter((h) => h.startOffset >= 0 && h.endOffset > h.startOffset && h.endOffset <= text.length)
    .sort((a, b) => a.startOffset - b.startOffset || a.endOffset - b.endOffset)
    .reduce<HighlightEntry[]>((acc, h) => {
      const last = acc[acc.length - 1];
      if (!last || h.startOffset >= last.endOffset) {
        acc.push({ ...h });
        return acc;
      }
      if (h.endOffset > last.endOffset) {
        acc[acc.length - 1] = { ...last, endOffset: h.endOffset };
      }
      return acc;
    }, []);
}

function findNearestTextRange(text: string, selectedText: string, expectedStart: number) {
  if (!selectedText) return null;
  let searchFrom = 0;
  let bestStart = -1;
  let bestDistance = Number.POSITIVE_INFINITY;

  while (searchFrom <= text.length) {
    const found = text.indexOf(selectedText, searchFrom);
    if (found === -1) break;
    const distance = Math.abs(found - expectedStart);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestStart = found;
    }
    searchFrom = found + 1;
  }

  if (bestStart === -1) return null;
  return { startOffset: bestStart, endOffset: bestStart + selectedText.length };
}

function resolveSelectionRangeInText(
  text: string,
  selectedText: string,
  fallbackStart: number,
  fallbackEnd: number,
) {
  const selected = normalizeSelectionText(selectedText);
  if (!selected) {
    return {
      startOffset: Math.max(0, Math.min(fallbackStart, text.length)),
      endOffset: Math.max(0, Math.min(fallbackEnd, text.length)),
    };
  }
  const nearest = findNearestTextRange(text, selected, fallbackStart);
  if (nearest) return nearest;
  return {
    startOffset: Math.max(0, Math.min(fallbackStart, text.length)),
    endOffset: Math.max(0, Math.min(fallbackEnd, text.length)),
  };
}

function normalizeHighlightOffsetsForText(text: string, highlight: HighlightEntry): HighlightEntry {
  const startOffset = Math.max(0, Math.min(highlight.startOffset, text.length));
  const endOffset = Math.max(startOffset, Math.min(highlight.endOffset, text.length));
  const resolved = resolveSelectionRangeInText(text, highlight.selectedText, startOffset, endOffset);
  const selected = normalizeSelectionText(highlight.selectedText);
  if (!selected) {
    return { ...highlight, startOffset, endOffset };
  }
  return { ...highlight, startOffset: resolved.startOffset, endOffset: resolved.endOffset };
}

function renderHighlightedTextWithLineBreakSpacing(text: string, highlights: HighlightEntry[]) {
  const normalized = text.replace(/\r\n/g, "\n");
  const merged = mergeHighlights(
    normalized,
    highlights.map((highlight) => normalizeHighlightOffsetsForText(normalized, highlight)),
  );
  const lines = normalized.split("\n");

  let lineStartOffset = 0;

  return (
    <span className="block space-y-2">
      {lines.map((line, lineIndex) => {
        const lineEndOffset = lineStartOffset + line.length;
        const pieces: React.ReactNode[] = [];
        let cursor = 0;

        for (let i = 0; i < merged.length; i += 1) {
          const h = merged[i];
          if (h.endOffset <= lineStartOffset || h.startOffset >= lineEndOffset) continue;

          const localStart = Math.max(0, h.startOffset - lineStartOffset);
          const localEnd = Math.min(line.length, h.endOffset - lineStartOffset);
          if (localStart > cursor) {
            pieces.push(<span key={`t-${lineIndex}-${i}`}>{line.slice(cursor, localStart)}</span>);
          }
          pieces.push(
            <mark
              key={`h-${lineIndex}-${i}`}
              className={`${highlightBgClass(h.color)} rounded-[2px] px-[1px] text-inherit`}
            >
              {line.slice(localStart, localEnd)}
            </mark>,
          );
          cursor = Math.max(cursor, localEnd);
        }

        if (cursor < line.length) {
          pieces.push(<span key={`tail-${lineIndex}`}>{line.slice(cursor)}</span>);
        }

        const node = pieces.length > 0 ? pieces : ["\u00A0"];
        const rendered = (
          <span key={`line-${lineIndex}`} className="block break-words">
            {node}
          </span>
        );

        lineStartOffset = lineEndOffset + 1;
        return rendered;
      })}
    </span>
  );
}

function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function textToEditorHtml(text: string) {
  const normalized = text.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  if (lines.length === 0) {
    return "<div><br></div>";
  }
  return lines
    .map((line) => (line.length > 0 ? `<div>${escapeHtml(line)}</div>` : "<div><br></div>"))
    .join("");
}

function readEditorText(editor: HTMLElement) {
  // For editable content, innerText preserves block boundaries as line breaks.
  const text = editor.innerText.replace(/\r\n/g, "\n");
  return text.endsWith("\n") ? text.slice(0, -1) : text;
}

function normalizeSelectionText(text: string) {
  return text.replace(/\r\n/g, "\n");
}

export default function EditorReaderPage() {
  const { t, i18n } = useTranslation();
  const { sermonId: sermonIdParam } = useParams();
  const navigate = useNavigate();
  const sermonId = sermonIdParam as SermonId | undefined;
  const uiLanguageCode = normalizeLanguageCode(i18n.language);
  const proofreaderLanguageCode = "nb";

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
  const savingDraftKeysRef = useRef<Set<string>>(new Set());
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const editableRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const pendingScrollAnchorRef = useRef<{ key: string; viewportY: number; offset: number } | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const modeTransitionMs = prefersReducedMotion ? 0 : 260;
  const modeStaggerMs = prefersReducedMotion ? 0 : 20;

  const modeFadeTransition = useMemo(
    () => (prefersReducedMotion ? { duration: 0.01 } : { duration: modeTransitionMs / 1000, ease: "easeOut" as const }),
    [prefersReducedMotion, modeTransitionMs],
  );

  const sermon = useQuery(
    api.sermons.getById,
    sermonId ? { id: sermonId as Id<"sermons">, languageCode: uiLanguageCode } : "skip",
  );
  const paragraphsResult = useQuery(
    api.editorial.listParagraphs,
    sermonId
      ? { sermonId, languageCode: proofreaderLanguageCode, paginationOpts: { cursor: null, numItems: 500 } }
      : "skip",
  );
  const isLoadingParagraphs = paragraphsResult === undefined;
  const paragraphs = useMemo(() => paragraphsResult?.page ?? [], [paragraphsResult]);
  const versionsResult = useQuery(
    api.editorial.listPublishedVersions as any,
    sermonId ? { sermonId, paginationOpts: { cursor: null, numItems: 20 } } : "skip",
  );
  const revertBaselinesResult = useQuery(
    api.editorial.listRevertBaselines as any,
    sermonId ? { sermonId, languageCode: proofreaderLanguageCode } : "skip",
  );
  const ensureParagraphs = useMutation(api.editorial.ensureParagraphsForSermon);
  const updateParagraphDraft = useMutation(api.editorial.updateParagraphDraft);
  const updateParagraphStatus = useMutation(api.editorial.updateParagraphStatus);
  const revertParagraphToLastApproved = useMutation(api.editorial.revertParagraphToLastApproved as any);

  useEffect(() => {
    if (!sermonId) return;
    ensureParagraphs({ sermonId, languageCode: proofreaderLanguageCode }).catch((error) => {
      console.error("Failed ensuring paragraphs", error);
    });
  }, [sermonId, ensureParagraphs, proofreaderLanguageCode]);

  const segments = useMemo<Segment[]>(() => {
    return paragraphs.map((p: any) => ({
      key: String(p._id),
      paragraphId: p._id as ParagraphId,
      order: p.order,
      sourceText: p.sourceText,
      translatedText: p.translatedText,
      status: p.status,
    }));
  }, [paragraphs]);

  const switchColumnMode = useCallback(
    (nextMode: ColumnMode) => {
      if (nextMode === columnMode) return;

      const anchorY = Math.round(window.innerHeight * 0.45);
      const orderedKeys = segments.map((segment) => segment.key);
      let anchor: { key: string; offset: number } | null = null;
      for (const key of orderedKeys) {
        const row = rowRefs.current.get(key);
        if (!row) continue;
        const rect = row.getBoundingClientRect();
        if (rect.bottom > anchorY) {
          anchor = { key, offset: rect.top - anchorY };
          break;
        }
      }
      if (!anchor && orderedKeys.length > 0) {
        const firstKey = orderedKeys[0];
        const firstRow = rowRefs.current.get(firstKey);
        if (firstRow) {
          anchor = { key: firstKey, offset: firstRow.getBoundingClientRect().top - anchorY };
        }
      }

      pendingScrollAnchorRef.current = anchor
        ? { key: anchor.key, viewportY: anchorY, offset: anchor.offset }
        : null;
      setColumnMode(nextMode);
    },
    [columnMode, segments],
  );

  useLayoutEffect(() => {
    const anchor = pendingScrollAnchorRef.current;
    if (!anchor) return;

    let frames = 0;
    const maxFrames = prefersReducedMotion ? 1 : 14;
    let rafId = 0;

    const restore = () => {
      const row = rowRefs.current.get(anchor.key);
      if (!row) return;
      const currentOffset = row.getBoundingClientRect().top - anchor.viewportY;
      const delta = currentOffset - anchor.offset;
      if (Math.abs(delta) < 0.5) return;
      window.scrollTo({ top: window.scrollY + delta, behavior: "auto" });
    };

    const tick = () => {
      restore();
      frames += 1;
      if (frames < maxFrames) {
        rafId = requestAnimationFrame(tick);
      }
    };

    rafId = requestAnimationFrame(tick);
    const settleMs = prefersReducedMotion ? 0 : 260;
    const timeoutId = window.setTimeout(() => {
      restore();
      pendingScrollAnchorRef.current = null;
    }, settleMs);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.clearTimeout(timeoutId);
    };
  }, [columnMode, prefersReducedMotion]);

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
      getPrivateToolbarPrefs({ sermonId, languageCode: proofreaderLanguageCode }),
      listPrivateHighlights({ sermonId, languageCode: proofreaderLanguageCode }),
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
  }, [sermonId, proofreaderLanguageCode]);

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

  const canClearActiveSelection = useMemo(() => {
    if (!activeSelection) return false;
    const selectedSegment = segments.find((segment) => segment.paragraphId === activeSelection.paragraphId);
    const selectedSegmentText = selectedSegment
      ? drafts[selectedSegment.key] ?? selectedSegment.translatedText
      : "";
    const resolvedSelection = resolveSelectionRangeInText(
      selectedSegmentText,
      activeSelection.selectedText,
      activeSelection.startOffset,
      activeSelection.endOffset,
    );
    return highlights
      .map((h) => normalizeHighlightOffsetsForText(selectedSegmentText, h))
      .some(
        (h) =>
          h.paragraphId === activeSelection.paragraphId &&
          rangesOverlap(h.startOffset, h.endOffset, resolvedSelection.startOffset, resolvedSelection.endOffset),
      );
  }, [activeSelection, highlights, segments, drafts]);

  const setBusy = (key: string, busy: boolean) => {
    setBusyKeys((prev) => ({ ...prev, [key]: busy }));
  };

  const persistToolbarPrefs = useCallback(
    async (next: { fontSizePx?: number; bookmarked?: boolean }) => {
      if (!sermonId) return;
      try {
        await setPrivateToolbarPrefs({
          sermonId,
          languageCode: proofreaderLanguageCode,
          fontSizePx: next.fontSizePx ?? fontSizePx,
          bookmarked: next.bookmarked ?? bookmarked,
        });
      } catch (error) {
        console.error("Failed persisting local toolbar prefs", error);
      }
    },
    [sermonId, proofreaderLanguageCode, fontSizePx, bookmarked],
  );

  const ensureDrafting = useCallback(
    async (segment: Segment) => {
      if (!segment.paragraphId || segment.status !== "approved") return;
      setBusy(segment.key, true);
      try {
        await updateParagraphStatus({
          paragraphId: segment.paragraphId,
          languageCode: proofreaderLanguageCode,
          status: "drafting",
          reason: "Edit requested in editor proofreader",
        });
      } finally {
        setBusy(segment.key, false);
      }
    },
    [updateParagraphStatus, proofreaderLanguageCode],
  );

  const saveDraft = useCallback(
    async (segment: Segment, submitForReview = false) => {
      if (!segment.paragraphId) return;
      if (savingDraftKeysRef.current.has(segment.key)) return;
      savingDraftKeysRef.current.add(segment.key);
      setBusy(segment.key, true);
      try {
        await updateParagraphDraft({
          paragraphId: segment.paragraphId,
          languageCode: proofreaderLanguageCode,
          translatedText: drafts[segment.key] ?? segment.translatedText,
          reason: submitForReview
            ? "Submitted for review from editor proofreader"
            : "Saved draft from editor proofreader",
          submitForReview,
        });
      } finally {
        setBusy(segment.key, false);
        savingDraftKeysRef.current.delete(segment.key);
      }
    },
    [updateParagraphDraft, proofreaderLanguageCode, drafts],
  );

  const approve = useCallback(
    async (segment: Segment) => {
      if (!segment.paragraphId) return;
      setBusy(segment.key, true);
      try {
        await updateParagraphStatus({
          paragraphId: segment.paragraphId,
          languageCode: proofreaderLanguageCode,
          status: "approved",
          reason: "Approved in editor proofreader",
        });
      } finally {
        setBusy(segment.key, false);
      }
    },
    [updateParagraphStatus, proofreaderLanguageCode],
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
          languageCode: proofreaderLanguageCode,
          reason: "Reverted to last approved translation from editor proofreader",
        });
        if (result?.translatedText) {
          setDrafts((prev) => ({ ...prev, [segment.key]: result.translatedText as string }));
        }
      } finally {
        setBusy(segment.key, false);
      }
    },
    [revertParagraphToLastApproved, proofreaderLanguageCode],
  );

  const captureSelection = (segment: Segment, element: HTMLElement) => {
    if (!segment.paragraphId) {
      setActiveSelection(null);
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      setActiveSelection(null);
      return;
    }

    const range = selection.getRangeAt(0);
    if (!element.contains(range.startContainer) || !element.contains(range.endContainer)) {
      setActiveSelection(null);
      return;
    }

    const fullRange = range.cloneRange();
    fullRange.selectNodeContents(element);

    const startRange = range.cloneRange();
    startRange.selectNodeContents(element);
    startRange.setEnd(range.startContainer, range.startOffset);

    const endRange = range.cloneRange();
    endRange.selectNodeContents(element);
    endRange.setEnd(range.endContainer, range.endOffset);

    const canonical = normalizeSelectionText(fullRange.toString());
    const start = normalizeSelectionText(startRange.toString()).length;
    const end = normalizeSelectionText(endRange.toString()).length;

    if (end <= start) {
      setActiveSelection(null);
      return;
    }
    const selectedText = canonical.slice(start, end);
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

  useEffect(() => {
    for (const segment of segments) {
      const editor = editableRefs.current.get(segment.key);
      if (!editor) continue;
      if (document.activeElement === editor) continue;
      const target = drafts[segment.key] ?? segment.translatedText;
      const current = readEditorText(editor);
      if (current !== target) {
        editor.innerHTML = textToEditorHtml(target);
      }
    }
  }, [segments, drafts]);

  const applyHighlight = async (color: HighlightColor) => {
    if (!sermonId) return;
    setSelectedHighlightColor(color);
    if (!activeSelection) return;

    const selectedSegment = segments.find((segment) => segment.paragraphId === activeSelection.paragraphId);
    const selectedSegmentText = selectedSegment
      ? drafts[selectedSegment.key] ?? selectedSegment.translatedText
      : "";
    const resolvedSelection = resolveSelectionRangeInText(
      selectedSegmentText,
      activeSelection.selectedText,
      activeSelection.startOffset,
      activeSelection.endOffset,
    );
    const paragraphHighlights = highlights
      .filter((h) => h.paragraphId === activeSelection.paragraphId)
      .map((h) => normalizeHighlightOffsetsForText(selectedSegmentText, h));
    const overlapping = paragraphHighlights.filter((h) =>
      rangesOverlap(h.startOffset, h.endOffset, resolvedSelection.startOffset, resolvedSelection.endOffset),
    );
    const overlappingSameColor = overlapping.filter((h) => h.color === color);

    if (overlappingSameColor.length > 0) {
      const mergedRanges = [...overlappingSameColor]
        .sort((a, b) => a.startOffset - b.startOffset || a.endOffset - b.endOffset)
        .reduce<Array<{ startOffset: number; endOffset: number }>>((acc, h) => {
          const last = acc[acc.length - 1];
          if (!last || h.startOffset > last.endOffset) {
            acc.push({ startOffset: h.startOffset, endOffset: h.endOffset });
            return acc;
          }
          if (h.endOffset > last.endOffset) {
            last.endOffset = h.endOffset;
          }
          return acc;
        }, []);
      const selectionCovered = mergedRanges.some(
        (h) => h.startOffset <= resolvedSelection.startOffset && h.endOffset >= resolvedSelection.endOffset,
      );

      // Fast remove when re-applying the same color over an already-highlighted selection.
      if (selectionCovered) {
        try {
          await Promise.all(overlappingSameColor.map((h) => deletePrivateHighlight(h._id)));
          const deleteIds = new Set(overlappingSameColor.map((h) => h._id));
          setLocalHighlights((prev) => prev.filter((h) => !deleteIds.has(h._id)));
        } catch (error) {
          console.error("Failed removing local highlight", error);
        }
        return;
      }
    }

    const mergedStart = Math.min(
      resolvedSelection.startOffset,
      ...overlappingSameColor.map((h) => h.startOffset),
    );
    const mergedEnd = Math.max(
      resolvedSelection.endOffset,
      ...overlappingSameColor.map((h) => h.endOffset),
    );
    const mergedSelectedText = selectedSegmentText.slice(mergedStart, mergedEnd);

    if (overlappingSameColor.length > 0) {
      try {
        await Promise.all(overlappingSameColor.map((h) => deletePrivateHighlight(h._id)));
        const deleteIds = new Set(overlappingSameColor.map((h) => h._id));
        setLocalHighlights((prev) => prev.filter((h) => !deleteIds.has(h._id)));
      } catch (error) {
        console.error("Failed replacing local highlight", error);
      }
    }

    try {
      const saved = await upsertPrivateHighlight({
        sermonId,
        paragraphId: activeSelection.paragraphId,
        languageCode: proofreaderLanguageCode,
        color,
        startOffset: mergedStart,
        endOffset: mergedEnd,
        selectedText: mergedSelectedText || activeSelection.selectedText,
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
          _id: `local-${activeSelection.paragraphId}-${mergedStart}-${mergedEnd}-${color}`,
          paragraphId: activeSelection.paragraphId,
          color,
          startOffset: mergedStart,
          endOffset: mergedEnd,
          selectedText: mergedSelectedText || activeSelection.selectedText,
        },
      ]);
    }
  };

  const clearSelectionHighlights = useCallback(async () => {
    if (!activeSelection) return;
    const selectedSegment = segments.find((segment) => segment.paragraphId === activeSelection.paragraphId);
    const selectedSegmentText = selectedSegment
      ? drafts[selectedSegment.key] ?? selectedSegment.translatedText
      : "";
    const resolvedSelection = resolveSelectionRangeInText(
      selectedSegmentText,
      activeSelection.selectedText,
      activeSelection.startOffset,
      activeSelection.endOffset,
    );
    const overlapping = highlights
      .map((h) => normalizeHighlightOffsetsForText(selectedSegmentText, h))
      .filter(
        (h) =>
          h.paragraphId === activeSelection.paragraphId &&
          rangesOverlap(h.startOffset, h.endOffset, resolvedSelection.startOffset, resolvedSelection.endOffset),
      );
    const overlappingIds = new Set(overlapping.map((h) => h._id));
    const toDelete = highlights.filter((h) => overlappingIds.has(h._id));
    if (toDelete.length === 0) return;

    try {
      await Promise.all(toDelete.map((h) => deletePrivateHighlight(h._id)));
      const deleteIds = new Set(toDelete.map((h) => h._id));
      setLocalHighlights((prev) => prev.filter((h) => !deleteIds.has(h._id)));
    } catch (error) {
      console.error("Failed clearing local highlights", error);
    }
  }, [activeSelection, highlights, segments, drafts]);

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
      const payload = await exportPrivateAnnotations({
        sermonId,
        languageCode: proofreaderLanguageCode,
      });
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `sermon-${sermonId}-${proofreaderLanguageCode}-annotations.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed exporting annotations", error);
    }
  }, [sermonId, proofreaderLanguageCode]);

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
          languageCode: proofreaderLanguageCode,
          jsonText: text,
          strategy: "merge",
        });
        const [prefs, highlights] = await Promise.all([
          getPrivateToolbarPrefs({ sermonId, languageCode: proofreaderLanguageCode }),
          listPrivateHighlights({ sermonId, languageCode: proofreaderLanguageCode }),
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
    [sermonId, proofreaderLanguageCode],
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
          <span>{formatDate(sermon.date, uiLanguageCode)}</span>
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
              onClick={() => switchColumnMode("one")}
              className={`inline-flex items-center gap-1.5 rounded-md px-5 py-2 text-[13px] font-medium ${
                columnMode === "one"
                  ? "bg-primary text-[#093255]"
                  : "bg-surface-container text-on-surface-variant"
              }`}
            >
              <Square size={14} />
              {t("proofreading.mode.one")}
            </button>
            <button
              onClick={() => switchColumnMode("two")}
              className={`inline-flex items-center gap-1.5 rounded-md px-5 py-2 text-[13px] font-medium ${
                columnMode === "two"
                  ? "bg-primary text-[#093255]"
                  : "bg-surface-container text-on-surface-variant"
              }`}
            >
              <Columns2 size={14} />
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
              <button
                onClick={() => clearSelectionHighlights()}
                disabled={!canClearActiveSelection}
                className="ml-1 inline-flex h-[20px] w-[20px] items-center justify-center rounded border border-[#43474e] text-on-surface-variant disabled:opacity-40"
                aria-label={t("editorial.clearHighlight", "Clear highlight")}
                title={t("editorial.clearHighlight", "Clear highlight")}
              >
                <Eraser size={12} />
              </button>
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
              <div className="flex h-full w-full">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${counts.approvedPct}%` }}
                />
                <div
                  className="h-full bg-secondary transition-all duration-300"
                  style={{ width: `${counts.pendingPct}%` }}
                />
              </div>
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

          {isLoadingParagraphs ? (
            <ProofreaderShimmerRows columnMode={columnMode} />
          ) : segments.length === 0 ? (
            <div className="px-8 py-10">
              <div className="rounded-lg border border-outline/20 bg-surface-container-low p-6 text-sm text-on-surface-variant">
                {t("reader.noParagraphs", "No paragraphs available for this sermon yet.")}
              </div>
            </div>
          ) : (
            <>
              {segments.map((segment, index) => {
                const state = statusMeta(segment.status, t);
                const compareIsOpen = compareOpen[segment.key] ?? false;
                const isTwoColumn = columnMode === "two";
                const currentText = drafts[segment.key] ?? segment.translatedText;
                const dirty = currentText.trim() !== segment.translatedText.trim();
                const lockedApproved = segment.status === "approved";
                const saving = !!busyKeys[segment.key];
                const revertTargetText =
                  segment.paragraphId
                    ? (revertBaselineByParagraphId.get(String(segment.paragraphId)) ?? segment.translatedText)
                    : segment.translatedText;
                const canRevert = !!segment.paragraphId && currentText !== revertTargetText;
                const colors = segment.paragraphId
                  ? (paragraphHighlightColors.get(String(segment.paragraphId)) ?? [])
                  : [];
                const showEdit = segment.status === "approved";
                const showReviewActions = segment.status === "draft" || segment.status === "drafting";
                const showApprove = segment.status === "needs_review";
                const iconButtonBase =
                  "inline-flex h-6 w-6 items-center justify-center rounded border text-on-surface-variant transition-colors disabled:opacity-45";
                const iconButtonNeutral = `${iconButtonBase} border-outline/30 hover:text-on-surface`;
                const iconButtonDestructive = `${iconButtonBase} border-[#5b3a3d] text-red-400`;
                const iconButtonPrimary = `${iconButtonBase} border-primary bg-primary text-black`;

                return (
                  <motion.div
                    key={segment.key}
                    ref={(node) => {
                      if (node) {
                        rowRefs.current.set(segment.key, node);
                      } else {
                        rowRefs.current.delete(segment.key);
                      }
                    }}
                    className={`border-b border-outline/20 ${rowTone(index)} px-8 py-5`}
                  >
                    <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-4">
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
                        <div className="flex items-center justify-end gap-1">
                          <span className="inline-flex h-6 w-6" aria-hidden />
                          {showEdit && (
                            <button
                              onClick={() => ensureDrafting(segment)}
                              disabled={saving}
                              className={iconButtonNeutral}
                              aria-label={t("proofreading.editSegment", { key: segment.key })}
                            >
                              <Pencil size={12} />
                            </button>
                          )}
                          {showReviewActions && (
                            <>
                              <button
                                onMouseDown={() => setSuppressBlurSaveKey(segment.key)}
                                onClick={() => saveDraft(segment, true)}
                                disabled={saving}
                                className={iconButtonNeutral}
                                aria-label={t("proofreading.requestApproval")}
                              >
                                <Send size={12} />
                              </button>
                              {canRevert && (
                                <button
                                  onMouseDown={() => setSuppressBlurSaveKey(segment.key)}
                                  onClick={() => revertToLastApproved(segment)}
                                  disabled={saving}
                                  className={iconButtonDestructive}
                                  aria-label={t("proofreading.revertDraftChanges")}
                                >
                                  <RotateCcw size={12} />
                                </button>
                              )}
                            </>
                          )}
                          {showApprove && (
                            <button
                              onClick={() => approveIfClean(segment)}
                              disabled={saving}
                              className={iconButtonPrimary}
                              aria-label={t("proofreading.approveSegment")}
                            >
                              <Check size={12} strokeWidth={2.6} className="text-black" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div
                        className={`grid min-w-0 transition-[grid-template-columns,gap] ease-out ${
                          isTwoColumn ? "grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-6" : "grid-cols-[0px_minmax(0,1fr)] gap-0"
                        }`}
                        style={{ transitionDuration: `${modeTransitionMs}ms` }}
                      >
                        <div
                          className={`min-w-0 min-h-0 overflow-hidden transition-opacity ease-out ${isTwoColumn ? "opacity-100" : "opacity-0 h-0"}`}
                          style={{
                            transitionDuration: `${modeTransitionMs}ms`,
                            transitionDelay: isTwoColumn ? `${modeStaggerMs}ms` : "0ms",
                          }}
                          aria-hidden={!isTwoColumn}
                        >
                          <div
                            className={`min-w-0 overflow-hidden italic text-on-surface-variant leading-relaxed transition-[padding-right,border-right-width] ease-out ${
                              isTwoColumn ? "whitespace-normal pr-4 border-r border-outline/25" : "whitespace-nowrap pr-0 border-r-0"
                            }`}
                            style={{ fontSize: `${fontSizePx}px`, transitionDuration: `${modeTransitionMs}ms` }}
                          >
                            {renderTextWithLineBreakSpacing(segment.sourceText)}
                          </div>
                        </div>

                        <div className={`min-w-0 ${isTwoColumn ? "pl-2" : ""}`}>
                          <div className={`min-w-0 ${isTwoColumn ? "space-y-3" : "flex items-start gap-2"}`}>
                            <div className="min-w-0 flex-1 space-y-3">
                              {!isTwoColumn && (
                                <AnimatePresence initial={false}>
                                  {compareIsOpen && (
                                    <motion.div
                                      key={`compare-${segment.key}`}
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: "auto", opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      transition={modeFadeTransition}
                                      className="overflow-hidden"
                                    >
                                      <div className="space-y-2 pb-1">
                                        <div className="text-[10px] uppercase tracking-[0.14em] text-outline">
                                          {t("reader.original")}
                                        </div>
                                        <p
                                          className="italic text-on-surface-variant leading-relaxed"
                                          style={{ fontSize: `${fontSizePx}px` }}
                                        >
                                          {renderTextWithLineBreakSpacing(segment.sourceText)}
                                        </p>
                                        <div className="h-px bg-outline/35" />
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              )}

                              <div className="relative">
                                <div
                                  className="pointer-events-none absolute inset-0 text-on-surface leading-relaxed"
                                  style={{ fontSize: `${fontSizePx}px` }}
                                >
                                  {renderHighlightedTextWithLineBreakSpacing(
                                    currentText,
                                    highlights.filter((h) => h.paragraphId === segment.paragraphId),
                                  )}
                                </div>
                                <div
                                  ref={(node) => {
                                    if (node) {
                                      editableRefs.current.set(segment.key, node);
                                      if (!node.innerHTML.trim()) {
                                        node.innerHTML = textToEditorHtml(currentText);
                                      }
                                    } else {
                                      editableRefs.current.delete(segment.key);
                                    }
                                  }}
                                  contentEditable={!lockedApproved && !saving}
                                  suppressContentEditableWarning
                                  spellCheck={false}
                                  onSelect={(e) => captureSelection(segment, e.currentTarget)}
                                  onKeyUp={(e) => captureSelection(segment, e.currentTarget)}
                                  onMouseUp={(e) => captureSelection(segment, e.currentTarget)}
                                  onInput={(e) => {
                                    const nextValue = readEditorText(e.currentTarget);
                                    setDrafts((prev) => ({ ...prev, [segment.key]: nextValue }));
                                  }}
                                  onBlur={() => {
                                    if (suppressBlurSaveKey === segment.key) {
                                      setSuppressBlurSaveKey(null);
                                      return;
                                    }
                                    if (!lockedApproved && dirty) {
                                      saveDraft(segment, false).catch((e) => console.error(e));
                                    }
                                  }}
                                  className={`relative z-10 block w-full min-h-20 rounded px-0 py-0 text-transparent caret-on-surface leading-relaxed whitespace-pre-wrap break-words focus:outline-none [&>div+div]:mt-2 [&>p+p]:mt-2 ${
                                    lockedApproved ? "opacity-95" : "focus:outline-none focus:ring-0"
                                  }`}
                                  style={{ fontSize: `${fontSizePx}px` }}
                                />
                              </div>
                            </div>

                            {!isTwoColumn && (
                              <button
                                onClick={() => setCompareOpen((prev) => ({ ...prev, [segment.key]: !compareIsOpen }))}
                                className={`${iconButtonNeutral} shrink-0`}
                                aria-label={compareIsOpen ? t("editorial.hideCompare") : t("editorial.compare")}
                              >
                                {compareIsOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </>
          )}
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
