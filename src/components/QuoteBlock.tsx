import { Quote } from "lucide-react";

export default function QuoteBlock() {
  return (
    <section className="py-40 bg-surface-container-low relative overflow-hidden">
      <div className="absolute inset-0 opacity-5 flex items-center justify-center pointer-events-none">
        <span className="text-[20rem] font-headline font-bold text-on-surface">B</span>
      </div>
      <div className="max-w-4xl mx-auto px-8 text-center relative z-10">
        <Quote className="text-secondary mx-auto mb-12" size={64} fill="currentColor" />
        <blockquote className="text-3xl md:text-5xl font-headline leading-tight text-on-surface italic mb-12">
          "Gud forandrer aldri Sin plan. Han er den samme i går, i dag og til evig tid."
        </blockquote>
        <cite className="not-italic block">
          <span className="text-primary font-semibold tracking-widest uppercase text-sm">William Marrion Branham</span>
          <span className="text-on-surface-variant text-sm mt-1 block">1909 — 1965</span>
        </cite>
      </div>
    </section>
  );
}
