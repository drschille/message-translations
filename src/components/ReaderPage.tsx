import { useState } from "react";
import FullReadMode from "./FullReadMode";
import ProofreadingWorkflow from "./ProofreadingWorkflow";

interface ReaderPageProps {
  sermon?: any;
  onBack: () => void;
}

export default function ReaderPage({ sermon, onBack }: ReaderPageProps) {
  const [mode, setMode] = useState<"read" | "proofread">("read");

  return (
    <>
      <div className="fixed right-4 top-20 z-[70] md:right-8">
        <div className="inline-flex rounded-full border border-outline/30 bg-surface-container p-1 shadow-xl">
          <button
            onClick={() => setMode("read")}
            className={`rounded-full px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] transition ${
              mode === "read" ? "bg-primary text-on-primary" : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Full Read
          </button>
          <button
            onClick={() => setMode("proofread")}
            className={`rounded-full px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] transition ${
              mode === "proofread" ? "bg-secondary text-on-secondary" : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Proofread
          </button>
        </div>
      </div>

      {mode === "read" ? (
        <FullReadMode sermon={sermon} onBack={onBack} />
      ) : (
        <ProofreadingWorkflow sermon={sermon} onBack={onBack} />
      )}
    </>
  );
}
