"use client";

import { X, Brain } from "lucide-react";

type ReasoningLevel = "" | "off" | "minimal" | "low" | "medium" | "high" | "xhigh";

const REASONING_LEVELS: Array<{
  value: ReasoningLevel;
  label: string;
  description: string;
  badge?: string;
}> = [
  {
    value: "",
    label: "Default",
    description: "Uses the model's built-in reasoning behavior. Recommended for most tasks.",
  },
  {
    value: "off",
    label: "Off",
    description: "Disables extended thinking entirely. Fastest and cheapest — best for simple Q&A or instructions.",
  },
  {
    value: "minimal",
    label: "Minimal",
    description: "A brief reasoning pass before responding. Good for light tasks where a small amount of deliberation helps.",
  },
  {
    value: "low",
    label: "Low",
    description: "Low-effort reasoning. Useful for straightforward coding, writing, and structured tasks.",
  },
  {
    value: "medium",
    label: "Medium",
    description: "Balanced reasoning. A solid general-purpose level for analysis, debugging, and creative tasks.",
    badge: "Balanced",
  },
  {
    value: "high",
    label: "High",
    description: "Deep reasoning pass. Best for complex logic, multi-step planning, and hard coding problems.",
    badge: "Thorough",
  },
  {
    value: "xhigh",
    label: "XHigh",
    description: "Maximum reasoning budget. Slowest and most expensive — reserved for the hardest problems.",
    badge: "Max",
  },
];

type ReasoningModalProps = {
  open: boolean;
  currentValue: string;
  onSelect: (value: string | null) => void;
  onClose: () => void;
};

export const ReasoningModal = ({
  open,
  currentValue,
  onSelect,
  onClose,
}: ReasoningModalProps) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.75)" }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="ui-panel flex w-full max-w-md flex-col overflow-hidden rounded-2xl"
        style={{ maxHeight: "80vh" }}
      >
        {/* header */}
        <div
          className="flex shrink-0 items-center justify-between border-b px-5 py-3"
          style={{ borderColor: "#27272a" }}
        >
          <div className="flex items-center gap-2">
            <Brain className="h-3.5 w-3.5 text-white/40" />
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-white/50">
              Reasoning effort
            </span>
          </div>
          <button
            type="button"
            className="ui-btn-icon ui-btn-icon-xs"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* description */}
        <div className="shrink-0 border-b px-5 py-3" style={{ borderColor: "#27272a" }}>
          <p className="font-mono text-[10px] text-white/35 leading-relaxed">
            Controls how much the model "thinks" before responding. Higher effort = deeper reasoning,
            more compute, longer wait. Lower = faster, cheaper.
          </p>
        </div>

        {/* levels */}
        <div className="ui-scroll min-h-0 flex-1 overflow-y-auto p-2">
          <div className="flex flex-col gap-0.5">
            {REASONING_LEVELS.map((level) => {
              const isSelected = level.value === currentValue;
              return (
                <button
                  key={level.value}
                  type="button"
                  className={`flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition-colors ${
                    isSelected
                      ? "bg-white/10 text-white/95"
                      : "text-white/70 hover:bg-white/5 hover:text-white/90"
                  }`}
                  onClick={() => {
                    onSelect(level.value || null);
                    onClose();
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-mono text-[12px] font-semibold leading-tight">
                        {level.label}
                      </p>
                      {level.badge ? (
                        <span className="rounded-sm bg-violet-500/20 px-1 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-[0.06em] text-violet-400">
                          {level.badge}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 font-mono text-[10px] text-white/40 leading-relaxed">
                      {level.description}
                    </p>
                  </div>
                  {isSelected ? (
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
