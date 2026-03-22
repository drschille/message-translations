import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  FileOutput,
  History,
  Info,
  MessageSquare,
  Pencil,
  Save,
  Search,
} from "lucide-react";
import { formatDate } from "@/src/lib/utils";

interface ProofreadingWorkflowProps {
  sermon?: any;
  onBack: () => void;
}

type SegmentStatus = "draft" | "drafting" | "needs_review" | "approved";

interface Segment {
  id: string;
  sourceLabel: string;
  sourceText: string;
  translatedText: string;
  status: SegmentStatus;
}

const fallbackSegments: Segment[] = [
  {
    id: "001",
    sourceLabel: "EN-US [001]",
    sourceText:
      "\"Good evening, friends. It's a privilege to be back here again tonight in the house of the Lord, to serve Him. And we're expecting a great time tonight.\"",
    translatedText:
      "\"God kveld, venner. Det er et privilegium å være tilbake her igjen i kveld i Herrens hus, for å tjene Ham. Og vi forventer en herlig tid i kveld.\"",
    status: "approved",
  },
  {
    id: "002",
    sourceLabel: "EN-US [002]",
    sourceText:
      "\"Now, we are thinking today of how that the world has come to its place where it is today. We are in a changing time.\"",
    translatedText:
      "Nå tenker vi i dag på hvordan verden har kommet til det stedet den er i dag. Vi er i en skiftende tid.",
    status: "drafting",
  },
  {
    id: "003",
    sourceLabel: "EN-US [003]",
    sourceText:
      "\"Everything is changing. Politics is changing; national scenes are changing; the world itself is changing. But God's Word remains the same.\"",
    translatedText:
      "\"Alt forandrer seg. Politikken forandrer seg; nasjonale scener forandrer seg; selve verden forandrer seg. Men Guds Ord forblir det samme.\"",
    status: "needs_review",
  },
  {
    id: "004",
    sourceLabel: "EN-US [004]",
    sourceText:
      "\"And we must find that place that God has chosen for us to rest in. Not in some political system, not in some man-made idea, but in Christ.\"",
    translatedText:
      "\"Og vi må finne det stedet som Gud har valgt ut for oss å hvile i. Ikke i et politisk system, ikke i en menneskeskapt idé, men i Kristus.\"",
    status: "draft",
  },
];

function statusLabel(status: SegmentStatus) {
  if (status === "approved") return "Approved";
  if (status === "needs_review") return "Needs Review";
  if (status === "drafting") return "Drafting";
  return "Draft";
}

function statusClasses(status: SegmentStatus) {
  if (status === "approved") {
    return "bg-green-900/30 text-green-400 border border-green-500/20";
  }
  if (status === "needs_review") {
    return "bg-secondary/10 text-secondary border border-secondary/20";
  }
  if (status === "drafting") {
    return "bg-primary/15 text-primary border border-primary/20";
  }
  return "bg-surface-container-highest text-on-surface-variant border border-outline/20";
}

export default function ProofreadingWorkflow({ sermon, onBack }: ProofreadingWorkflowProps) {
  const [segments, setSegments] = useState<Segment[]>(fallbackSegments);
  const [activeSegmentId, setActiveSegmentId] = useState<string>(
    fallbackSegments.find((segment) => segment.status === "drafting")?.id ?? fallbackSegments[0].id,
  );
  const [draftText, setDraftText] = useState<string>(
    fallbackSegments.find((segment) => segment.id === activeSegmentId)?.translatedText ?? "",
  );
  const [lastSyncAt, setLastSyncAt] = useState<Date>(new Date());

  const sermonTitle = sermon?.title ?? "Det Valgte Hvilested";
  const sermonDate = sermon?.date ? formatDate(sermon.date) : "13. MAI 1965";
  const sermonCode = sermon?._id ?? "65-0221E";

  useEffect(() => {
    const selected = segments.find((segment) => segment.id === activeSegmentId);
    if (selected) {
      setDraftText(selected.translatedText);
    }
  }, [activeSegmentId, segments]);

  const activeSegment = useMemo(
    () => segments.find((segment) => segment.id === activeSegmentId) ?? segments[0],
    [activeSegmentId, segments],
  );

  const completion = useMemo(() => {
    if (!segments.length) return 0;
    const approved = segments.filter((segment) => segment.status === "approved").length;
    return Math.round((approved / segments.length) * 100);
  }, [segments]);

  const lastSyncText = useMemo(() => {
    const elapsedMs = Date.now() - lastSyncAt.getTime();
    const elapsedMinutes = Math.floor(elapsedMs / 60000);
    if (elapsedMinutes <= 1) return "just now";
    if (elapsedMinutes < 60) return `${elapsedMinutes} min ago`;
    return `${Math.floor(elapsedMinutes / 60)}h ago`;
  }, [lastSyncAt]);

  const startEditing = (segmentId: string) => {
    setSegments((prev) =>
      prev.map((segment) => {
        if (segment.id === segmentId && segment.status !== "approved") {
          return { ...segment, status: "drafting" };
        }
        return segment;
      }),
    );
    setActiveSegmentId(segmentId);
  };

  const saveDraft = () => {
    if (!activeSegment) return;
    setSegments((prev) =>
      prev.map((segment) =>
        segment.id === activeSegment.id
          ? {
              ...segment,
              translatedText: draftText.trim() || segment.translatedText,
              status: "needs_review",
            }
          : segment,
      ),
    );
    setLastSyncAt(new Date());
  };

  const discardDraft = () => {
    if (!activeSegment) return;
    setDraftText(activeSegment.translatedText);
  };

  const approveSegment = (segmentId: string) => {
    setSegments((prev) =>
      prev.map((segment) => (segment.id === segmentId ? { ...segment, status: "approved" } : segment)),
    );
    setLastSyncAt(new Date());
  };

  return (
    <main className="min-h-screen bg-background px-4 pb-16 pt-24 text-on-surface md:px-8">
      <div className="mx-auto max-w-6xl">
        <button
          onClick={onBack}
          className="mb-8 inline-flex items-center gap-2 rounded border border-outline/30 bg-surface-container-low px-3 py-2 text-xs font-bold uppercase tracking-[0.16em] text-on-surface-variant transition hover:border-primary/60 hover:text-primary"
        >
          <ChevronLeft size={14} />
          Back To Archive
        </button>

        <section className="mb-10 flex flex-col gap-6 border-b border-outline/20 pb-8 md:flex-row md:items-end md:justify-between">
          <div className="flex-1">
            <div className="mb-3 flex items-center gap-3">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
                Project: Sermon Translation
              </span>
              <span className="h-1 w-1 rounded-full bg-outline" />
              <span className="text-[10px] uppercase tracking-[0.2em] text-on-surface-variant">Branham Archive</span>
            </div>
            <h1 className="mb-2 font-headline text-4xl font-bold tracking-tight md:text-5xl">{sermonTitle}</h1>
            <p className="font-medium tracking-wide text-on-surface-variant">
              The Chosen Place of Rest - Jeffersonville, IN - {sermonCode} - {sermonDate}
            </p>
          </div>

          <div className="w-full md:w-64">
            <div className="rounded-xl border border-outline/20 bg-surface-container-low p-5">
              <div className="mb-3 flex items-end justify-between">
                <div>
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
                    Completion
                  </span>
                  <span className="font-headline text-2xl font-bold text-primary">{completion}%</span>
                </div>
                <div className="text-right">
                  <span className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-on-surface-variant">
                    Last Sync
                  </span>
                  <span className="text-xs font-mono text-primary/90">{lastSyncText}</span>
                </div>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-highest">
                <div className="h-full bg-primary transition-all duration-300" style={{ width: `${completion}%` }} />
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          {segments.map((segment) => {
            const isActive = segment.id === activeSegmentId && segment.status === "drafting";

            return (
              <div
                key={segment.id}
                className={`group relative grid overflow-hidden rounded-xl border transition-all duration-300 lg:grid-cols-2 ${
                  isActive
                    ? "border-secondary/30 bg-surface-container-high shadow-2xl"
                    : "border-transparent bg-surface-container-low hover:border-outline/30"
                }`}
              >
                <div
                  className={`border-b border-outline/20 p-8 lg:border-b-0 lg:border-r ${
                    isActive ? "bg-surface-container-highest/20" : ""
                  }`}
                >
                  <div className="mb-4 flex items-center gap-3">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-widest ${
                        isActive ? "text-secondary" : "text-on-surface-variant"
                      }`}
                    >
                      {segment.sourceLabel}
                    </span>
                    {isActive && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-secondary" />}
                  </div>
                  <p className={`font-headline leading-relaxed ${isActive ? "text-xl" : "text-lg italic text-on-surface-variant"}`}>
                    {segment.sourceText}
                  </p>
                </div>

                <div className="relative bg-surface-container p-8">
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <span
                      className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] ${statusClasses(segment.status)}`}
                    >
                      {statusLabel(segment.status)}
                    </span>

                    {!isActive && (
                      <div className="flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                        {segment.status === "needs_review" && (
                          <button
                            onClick={() => approveSegment(segment.id)}
                            className="rounded p-1.5 text-primary transition-colors hover:bg-surface-container-highest"
                            aria-label={`Approve segment ${segment.id}`}
                          >
                            <CheckCircle2 size={16} />
                          </button>
                        )}
                        <button
                          onClick={() => startEditing(segment.id)}
                          className="rounded p-1.5 transition-colors hover:bg-surface-container-highest"
                          aria-label={`Edit segment ${segment.id}`}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="rounded p-1.5 transition-colors hover:bg-surface-container-highest"
                          aria-label={`History for segment ${segment.id}`}
                        >
                          <History size={16} />
                        </button>
                        {segment.status === "needs_review" && (
                          <button
                            className="rounded p-1.5 transition-colors hover:bg-surface-container-highest"
                            aria-label={`Comment on segment ${segment.id}`}
                          >
                            <MessageSquare size={16} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {isActive ? (
                    <>
                      <textarea
                        className="h-32 w-full resize-none border-none bg-transparent p-0 font-headline text-xl leading-relaxed text-on-surface focus:ring-0"
                        spellCheck={false}
                        value={draftText}
                        onChange={(event) => setDraftText(event.target.value)}
                      />
                      <div className="mt-6 flex justify-end gap-3">
                        <button
                          onClick={discardDraft}
                          className="px-4 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-on-surface-variant transition-colors hover:text-on-surface"
                        >
                          Discard
                        </button>
                        <button
                          onClick={saveDraft}
                          className="rounded bg-gradient-to-br from-primary to-[#44658b] px-6 py-2 text-xs font-bold uppercase tracking-[0.16em] text-on-primary shadow-lg"
                        >
                          Save Changes
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p
                        className={`font-headline text-lg leading-relaxed ${
                          segment.status === "draft" ? "text-on-surface/50" : "text-on-surface"
                        }`}
                      >
                        {segment.translatedText}
                      </p>
                      {segment.status === "draft" && (
                        <div className="absolute inset-0 flex items-center justify-center bg-surface-container/40 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            onClick={() => startEditing(segment.id)}
                            className="inline-flex items-center gap-2 rounded-full border border-outline/30 bg-surface-container-highest px-6 py-2 text-xs font-bold uppercase tracking-[0.16em]"
                          >
                            <Pencil size={14} />
                            Resume Editing
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
                {isActive && <div className="absolute inset-y-0 left-0 w-1 bg-secondary" />}
              </div>
            );
          })}
        </section>

        <section className="mb-24 mt-16 flex items-center justify-between border-t border-outline/20 pt-8">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-on-surface-variant transition-colors hover:text-primary"
          >
            <ArrowLeft size={14} />
            Previous Page
          </button>
          <div className="flex gap-2">
            <span className="h-2 w-2 rounded-full bg-primary" />
            <span className="h-2 w-2 rounded-full bg-surface-container-highest" />
            <span className="h-2 w-2 rounded-full bg-surface-container-highest" />
            <span className="h-2 w-2 rounded-full bg-surface-container-highest" />
          </div>
          <button
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-on-surface-variant transition-colors hover:text-primary"
          >
            Next Page
            <ArrowRight size={14} />
          </button>
        </section>
      </div>

      <div className="fixed bottom-8 right-4 z-50 flex flex-col gap-3 md:right-8">
        <button
          className="flex h-14 w-14 items-center justify-center rounded-full border border-secondary/20 bg-surface-container-highest text-secondary shadow-xl transition-transform hover:scale-105"
          title="Search Archives"
        >
          <Search size={20} />
        </button>
        <button
          className="flex h-14 w-14 items-center justify-center rounded-full border border-primary/20 bg-surface-container-highest text-primary shadow-xl transition-transform hover:scale-105"
          title="Metadata and Settings"
        >
          <Info size={20} />
        </button>
        <button
          onClick={saveDraft}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-on-primary shadow-xl transition-transform hover:scale-105"
          title="Save Active Changes"
        >
          <Save size={20} />
        </button>
        <button className="mt-2 inline-flex h-14 items-center gap-2 rounded-full bg-gradient-to-br from-secondary to-[#584633] px-6 text-xs font-bold uppercase tracking-[0.16em] text-on-secondary shadow-xl transition-transform hover:scale-105">
          <FileOutput size={18} />
          Export Draft
        </button>
      </div>
    </main>
  );
}
