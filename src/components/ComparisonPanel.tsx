import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, Columns2 } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { ParagraphId, SermonId } from "@/src/types/editorial";
import { formatDate } from "@/src/lib/utils";

interface ComparisonPanelProps {
  sermon?: any;
  onBack: () => void;
}

function statusLabel(status: string) {
  if (status === "approved") return "Approved";
  if (status === "needs_review") return "Needs Review";
  if (status === "drafting") return "Drafting";
  return "Draft";
}

export default function ComparisonPanel({ sermon, onBack }: ComparisonPanelProps) {
  const sermonId = sermon?._id as SermonId | undefined;
  const ensureParagraphs = useMutation(api.editorial.ensureParagraphsForSermon);
  const paragraphsResult = useQuery(
    api.editorial.listParagraphs,
    sermonId ? { sermonId, paginationOpts: { cursor: null, numItems: 500 } } : "skip",
  );

  const paragraphs = useMemo(() => paragraphsResult?.page ?? [], [paragraphsResult]);
  const [activeParagraphId, setActiveParagraphId] = useState<ParagraphId | null>(null);

  useEffect(() => {
    if (!sermonId) return;
    ensureParagraphs({ sermonId }).catch((error) => {
      console.error("Failed ensuring paragraphs", error);
    });
  }, [sermonId, ensureParagraphs]);

  useEffect(() => {
    if (!paragraphs.length) return;
    if (!activeParagraphId || !paragraphs.find((paragraph) => paragraph._id === activeParagraphId)) {
      setActiveParagraphId(paragraphs[0]._id as ParagraphId);
    }
  }, [activeParagraphId, paragraphs]);

  const sermonTitle = sermon?.title ?? "Det Valgte Hvilested";
  const sermonDate = sermon?.date ? formatDate(sermon.date) : "13. MAI 1965";

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

        <section className="mb-8 border-b border-outline/20 pb-8">
          <div className="mb-3 inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-secondary">
            <Columns2 size={13} />
            Comparison Mode
          </div>
          <h1 className="font-headline text-4xl font-bold tracking-tight md:text-5xl">{sermonTitle}</h1>
          <p className="mt-2 text-on-surface-variant">Source and translation aligned paragraph-by-paragraph • {sermonDate}</p>
        </section>

        <section className="space-y-4">
          {paragraphs.length === 0 ? (
            <div className="rounded-lg border border-outline/20 bg-surface-container-low p-8 text-center text-on-surface-variant">
              Loading comparison view...
            </div>
          ) : (
            paragraphs.map((paragraph) => {
              const isActive = paragraph._id === activeParagraphId;
              return (
                <button
                  key={paragraph._id}
                  onClick={() => setActiveParagraphId(paragraph._id as ParagraphId)}
                  className={`grid w-full overflow-hidden rounded-xl border text-left transition-all duration-300 lg:grid-cols-2 ${
                    isActive
                      ? "border-primary/30 bg-surface-container-high shadow-xl"
                      : "border-outline/20 bg-surface-container-low hover:border-primary/20"
                  }`}
                >
                  <div className="border-b border-outline/20 p-6 lg:border-b-0 lg:border-r">
                    <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-secondary">
                      SOURCE [{String(paragraph.order).padStart(3, "0")}]
                    </div>
                    <p className="font-headline text-lg leading-relaxed text-on-surface-variant">{paragraph.sourceText}</p>
                  </div>
                  <div className="p-6">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">TRANSLATION</span>
                      <span className="rounded bg-surface-container-highest px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-on-surface-variant">
                        {statusLabel(paragraph.status)}
                      </span>
                    </div>
                    <p className="font-headline text-lg leading-relaxed text-on-surface">{paragraph.translatedText}</p>
                  </div>
                </button>
              );
            })
          )}
        </section>
      </div>
    </main>
  );
}
