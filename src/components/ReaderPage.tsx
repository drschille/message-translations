import { useState } from "react";
import ComparisonPanel from "./ComparisonPanel";
import FullReadMode from "./FullReadMode";
import ProofreadingWorkflow from "./ProofreadingWorkflow";

interface ReaderPageProps {
  sermon?: any;
  onBack: () => void;
}

export default function ReaderPage({ sermon, onBack }: ReaderPageProps) {
  const [mode, setMode] = useState<"read" | "compare" | "proofread">("read");
  const [proofreadDirty, setProofreadDirty] = useState(false);

  const maybeSwitchMode = (nextMode: "read" | "compare" | "proofread") => {
    if (mode === nextMode) return;
    if (mode === "proofread" && proofreadDirty) {
      const confirmed = window.confirm("You have unsaved proofreading changes. Leave without saving?");
      if (!confirmed) return;
    }
    setMode(nextMode);
  };

  const maybeGoBack = () => {
    if (mode === "proofread" && proofreadDirty) {
      const confirmed = window.confirm("You have unsaved proofreading changes. Go back anyway?");
      if (!confirmed) return;
    }
    onBack();
  };

  return (
    <>
      <div className="fixed left-1/2 top-5 z-[90] -translate-x-1/2">
        <div className="inline-flex rounded-full border border-outline/30 bg-surface-container/90 p-1 shadow-2xl backdrop-blur-xl">
          <button
            onClick={() => maybeSwitchMode("read")}
            className={`rounded-full px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] transition ${
              mode === "read" ? "bg-primary text-on-primary" : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Full Read
          </button>
          <button
            onClick={() => maybeSwitchMode("compare")}
            className={`rounded-full px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] transition ${
              mode === "compare" ? "bg-surface-container-highest text-on-surface" : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Compare
          </button>
          <button
            onClick={() => maybeSwitchMode("proofread")}
            className={`rounded-full px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] transition ${
              mode === "proofread" ? "bg-secondary text-on-secondary" : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Proofread
          </button>
        </div>
      </div>

      {mode === "read" ? (
        <FullReadMode sermon={sermon} onBack={maybeGoBack} />
      ) : mode === "compare" ? (
        <ComparisonPanel sermon={sermon} onBack={maybeGoBack} />
      ) : (
        <ProofreadingWorkflow sermon={sermon} onBack={maybeGoBack} onDirtyChange={setProofreadDirty} />
      )}
    </>
  );
}
