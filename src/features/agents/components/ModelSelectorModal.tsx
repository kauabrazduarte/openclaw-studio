"use client";

import { useMemo, useState } from "react";
import { Search, X, Cpu } from "lucide-react";
import type { GatewayModelChoice } from "@/lib/gateway/models";

type ModelSelectorModalProps = {
  open: boolean;
  modelOptions: { value: string; label: string; reasoning?: boolean }[];
  currentValue: string;
  models: GatewayModelChoice[];
  onSelect: (value: string) => void;
  onClose: () => void;
};

function resolveProviderLabel(provider: string): string {
  const map: Record<string, string> = {
    anthropic: "Anthropic",
    openai: "OpenAI",
    google: "Google",
    mistral: "Mistral",
    cohere: "Cohere",
    meta: "Meta",
    amazon: "Amazon",
  };
  return map[provider.toLowerCase()] ?? provider;
}

function formatContextWindow(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(0)}M ctx`;
  if (tokens >= 1_000) return `${Math.round(tokens / 1_000)}K ctx`;
  return `${tokens} ctx`;
}

export const ModelSelectorModal = ({
  open,
  modelOptions,
  currentValue,
  models,
  onSelect,
  onClose,
}: ModelSelectorModalProps) => {
  const [query, setQuery] = useState("");

  const modelMap = useMemo(() => {
    const map = new Map<string, GatewayModelChoice>();
    for (const m of models) {
      map.set(`${m.provider}/${m.id}`, m);
    }
    return map;
  }, [models]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return modelOptions;
    return modelOptions.filter(
      (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q)
    );
  }, [modelOptions, query]);

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
        style={{ maxHeight: "70vh" }}
      >
        {/* header */}
        <div
          className="flex shrink-0 items-center justify-between border-b px-5 py-3"
          style={{ borderColor: "#27272a" }}
        >
          <div className="flex items-center gap-2">
            <Cpu className="h-3.5 w-3.5 text-white/40" />
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-white/50">
              Select model
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

        {/* search */}
        <div className="relative shrink-0 border-b px-4 py-2.5" style={{ borderColor: "#27272a" }}>
          <Search
            className="absolute left-7 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/25 pointer-events-none"
          />
          <input
            type="text"
            autoFocus
            placeholder="Search models..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="sidebar-search-input pl-8"
            spellCheck={false}
          />
        </div>

        {/* model list */}
        <div className="ui-scroll min-h-0 flex-1 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center">
              <Search className="mb-2 h-5 w-5 text-white/15" />
              <p className="font-mono text-[11px] text-white/30">No models match</p>
            </div>
          ) : (
            <div className="flex flex-col gap-0.5">
              {filtered.map((option) => {
                const meta = modelMap.get(option.value);
                const provider = meta?.provider ?? option.value.split("/")[0] ?? "";
                const isSelected = option.value === currentValue;
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                      isSelected
                        ? "bg-white/10 text-white/95"
                        : "text-white/70 hover:bg-white/5 hover:text-white/90"
                    }`}
                    onClick={() => {
                      onSelect(option.value);
                      onClose();
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-[12px] font-medium leading-tight">
                        {option.label}
                      </p>
                      {provider ? (
                        <p className="mt-0.5 font-mono text-[10px] text-white/35">
                          {resolveProviderLabel(provider)}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {meta?.contextWindow ? (
                        <span className="font-mono text-[9px] text-white/25">
                          {formatContextWindow(meta.contextWindow)}
                        </span>
                      ) : null}
                      {option.reasoning ? (
                        <span className="rounded-sm bg-violet-500/20 px-1 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-[0.06em] text-violet-400">
                          Reasoning
                        </span>
                      ) : null}
                    </div>
                    {isSelected ? (
                      <span className="ml-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {filtered.length > 0 ? (
          <div
            className="shrink-0 border-t px-4 py-2"
            style={{ borderColor: "#27272a" }}
          >
            <p className="font-mono text-[10px] text-white/25">
              {filtered.length} model{filtered.length !== 1 ? "s" : ""} available
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
};
