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
    label: "Padrão",
    description: "Usa o comportamento de raciocínio nativo do modelo. Recomendado para a maioria das tarefas.",
  },
  {
    value: "off",
    label: "Desligado",
    description: "Desativa o raciocínio estendido completamente. Mais rápido e barato — ideal para perguntas simples ou instruções diretas.",
  },
  {
    value: "minimal",
    label: "Mínimo",
    description: "Uma rápida passagem de raciocínio antes de responder. Bom para tarefas leves onde uma pequena deliberação ajuda.",
  },
  {
    value: "low",
    label: "Baixo",
    description: "Raciocínio de baixo esforço. Útil para codificação direta, escrita e tarefas estruturadas.",
  },
  {
    value: "medium",
    label: "Médio",
    description: "Raciocínio equilibrado. Um bom nível geral para análise, depuração e tarefas criativas.",
    badge: "Equilibrado",
  },
  {
    value: "high",
    label: "Alto",
    description: "Raciocínio profundo. Ideal para lógica complexa, planejamento em múltiplas etapas e problemas difíceis de código.",
    badge: "Detalhado",
  },
  {
    value: "xhigh",
    label: "Máximo",
    description: "Orçamento máximo de raciocínio. Mais lento e caro — reservado para os problemas mais difíceis.",
    badge: "Máx",
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
        {/* cabeçalho */}
        <div
          className="flex shrink-0 items-center justify-between border-b px-5 py-3"
          style={{ borderColor: "#27272a" }}
        >
          <div className="flex items-center gap-2">
            <Brain className="h-3.5 w-3.5 text-white/40" />
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-white/50">
              Nível de raciocínio
            </span>
          </div>
          <button
            type="button"
            className="ui-btn-icon ui-btn-icon-xs"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* descrição */}
        <div className="shrink-0 border-b px-5 py-3" style={{ borderColor: "#27272a" }}>
          <p className="font-mono text-[10px] text-white/35 leading-relaxed">
            Controla o quanto o modelo "pensa" antes de responder. Maior esforço = raciocínio mais profundo,
            mais processamento, espera maior. Menor = mais rápido e barato.
          </p>
        </div>

        {/* níveis */}
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
