"use client";

import { useEffect, useState } from "react";
import type { AgentCreateModalSubmitPayload } from "@/features/agents/creation/types";
import type { AgentState } from "@/features/agents/state/store";

const AGENT_EMOJIS = [
  "🤖","🦾","🧠","⚡","🔮","🛡️","💡","🎯","📊","🚀",
  "⚙️","🔧","🎨","📝","🌐","💻","🔬","🌟","🔑","🏃",
  "🦊","🐉","🦁","🦅","🎪","🎭","🔭","🧬","🌊","🔥",
];

function resolveInitialEmoji(seed: string): string {
  if (AGENT_EMOJIS.includes(seed)) return seed;
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) >>> 0;
  }
  return AGENT_EMOJIS[h % AGENT_EMOJIS.length];
}

type AgentCreateModalProps = {
  open: boolean;
  suggestedName: string;
  busy?: boolean;
  submitError?: string | null;
  existingAgents?: AgentState[];
  onClose: () => void;
  onSubmit: (payload: AgentCreateModalSubmitPayload) => Promise<void> | void;
  onSelectExisting?: (agentId: string) => void;
};

const fieldClassName =
  "ui-input w-full rounded-md px-3 py-2 text-xs text-foreground outline-none";
const labelClassName =
  "font-mono text-[11px] font-semibold tracking-[0.05em] text-muted-foreground";

const resolveInitialName = (suggestedName: string): string => {
  const trimmed = suggestedName.trim();
  if (!trimmed) return "Novo Agente";
  return trimmed;
};

type GwAgent = { agentId: string; name: string };

const AgentCreateModalContent = ({
  suggestedName,
  busy,
  submitError,
  onClose,
  onSubmit,
  onSelectExisting,
}: Omit<AgentCreateModalProps, "open">) => {
  const [tab, setTab] = useState<"new" | "existing">("new");
  const [name, setName] = useState(() => resolveInitialName(suggestedName));
  const [search, setSearch] = useState("");

  // Gateway agents (fetched fresh from OpenClaw when "existing" tab opens)
  const [gwAgents, setGwAgents] = useState<GwAgent[] | null>(null);
  const [gwLoading, setGwLoading] = useState(false);
  const [gwError, setGwError] = useState<string | null>(null);

  useEffect(() => {
    if (tab !== "existing") return;
    if (gwAgents !== null || gwLoading) return;
    setGwLoading(true);
    setGwError(null);
    fetch("/api/runtime/fleet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
      .then((r) => r.json())
      .then((data: unknown) => {
        const seeds =
          (data as { result?: { seeds?: unknown[] } })?.result?.seeds ?? [];
        const agents: GwAgent[] = (seeds as Array<Record<string, unknown>>)
          .filter((s) => typeof s.agentId === "string" && typeof s.name === "string")
          .map((s) => ({ agentId: s.agentId as string, name: s.name as string }));
        setGwAgents(agents);
      })
      .catch(() => {
        setGwError("Falha ao carregar agentes do gateway.");
      })
      .finally(() => setGwLoading(false));
  }, [tab, gwAgents, gwLoading]);

  const canSubmit = name.trim().length > 0;

  const handleSubmit = () => {
    if (!canSubmit || busy) return;
    const trimmedName = name.trim();
    if (!trimmedName) return;
    void onSubmit({ name: trimmedName });
  };

  const filteredAgents = (gwAgents ?? []).filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-background/80 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Agente"
      onClick={busy ? undefined : onClose}
    >
      <div
        className="ui-panel w-full max-w-2xl rounded-t-2xl shadow-xs sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        data-testid="agent-create-modal"
      >
        {/* header */}
        <div className="flex items-center justify-between border-b border-border/35 px-4 py-4 sm:px-6">
          <div>
            <div className="font-mono text-[11px] font-semibold tracking-[0.06em] text-muted-foreground">
              Agente
            </div>
            <div className="mt-0.5 text-base font-semibold text-foreground">
              {tab === "new" ? "Lançar novo agente" : "Selecionar agente existente"}
            </div>
          </div>
          <button
            type="button"
            className="ui-btn-ghost px-3 py-1.5 font-mono text-[11px] font-semibold tracking-[0.06em] disabled:cursor-not-allowed disabled:opacity-60"
            onClick={onClose}
            disabled={busy}
          >
            Fechar
          </button>
        </div>

        {/* tabs */}
        {onSelectExisting ? (
          <div className="flex border-b border-border/35 px-4 sm:px-6">
            <button
              type="button"
              className={`mr-4 border-b-2 py-2.5 font-mono text-[11px] font-semibold tracking-[0.04em] transition-colors ${
                tab === "new"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setTab("new")}
            >
              Novo agente
            </button>
            <button
              type="button"
              className={`border-b-2 py-2.5 font-mono text-[11px] font-semibold tracking-[0.04em] transition-colors ${
                tab === "existing"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setTab("existing")}
            >
              Existente{gwAgents !== null ? ` (${gwAgents.length})` : ""}
            </button>
          </div>
        ) : null}

        {/* new agent form */}
        {tab === "new" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
          >
            <div className="grid gap-4 px-4 py-5 sm:px-6">
              <label className={labelClassName}>
                Nome
                <input
                  aria-label="Nome do agente"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={`mt-1 ${fieldClassName}`}
                  placeholder="Meu agente"
                  autoFocus
                />
              </label>
              <div className="-mt-2 text-[11px] text-muted-foreground">
                Você pode renomear o agente pelo cabeçalho do chat.
              </div>
              {submitError ? (
                <div className="ui-alert-danger rounded-md px-3 py-2 text-xs">
                  {submitError}
                </div>
              ) : null}
            </div>
            <div className="flex items-center justify-between border-t border-border/45 px-4 pb-4 pt-4 sm:px-6">
              <div className="text-[11px] text-muted-foreground">
                Permissões podem ser configuradas após o lançamento.
              </div>
              <button
                type="submit"
                className="ui-btn-primary px-3 py-1.5 font-mono text-[11px] font-semibold tracking-[0.06em] disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-muted-foreground"
                disabled={!canSubmit || busy}
              >
                {busy ? "Lançando..." : "Lançar agente"}
              </button>
            </div>
          </form>
        ) : (
          /* existing agents */
          <div className="flex flex-col">
            <div className="px-4 pt-4 pb-2 sm:px-6">
              <input
                className={fieldClassName}
                placeholder="Pesquisar agente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
            </div>
            <div className="max-h-72 overflow-y-auto px-4 pb-4 sm:px-6">
              {gwLoading ? (
                <p className="py-6 text-center font-mono text-[11px] text-muted-foreground">
                  Carregando agentes…
                </p>
              ) : gwError ? (
                <p className="py-6 text-center font-mono text-[11px] text-red-400">
                  {gwError}
                </p>
              ) : filteredAgents.length === 0 ? (
                <p className="py-6 text-center font-mono text-[11px] text-muted-foreground">
                  Nenhum agente encontrado.
                </p>
              ) : (
                <div className="space-y-1 pt-1">
                  {filteredAgents.map((agent) => {
                    const emoji = resolveInitialEmoji(agent.agentId);
                    return (
                      <button
                        key={agent.agentId}
                        type="button"
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-white/6 active:bg-white/10"
                        onClick={() => onSelectExisting?.(agent.agentId)}
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/8 text-lg">
                          {emoji}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-foreground">
                            {agent.name}
                          </div>
                          <div className="font-mono text-[10px] text-muted-foreground">
                            {agent.agentId}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const AgentCreateModal = ({
  open,
  suggestedName,
  busy = false,
  submitError = null,
  existingAgents = [],
  onClose,
  onSubmit,
  onSelectExisting,
}: AgentCreateModalProps) => {
  if (!open) return null;
  return (
    <AgentCreateModalContent
      suggestedName={suggestedName}
      busy={busy}
      submitError={submitError}
      existingAgents={existingAgents}
      onClose={onClose}
      onSubmit={onSubmit}
      onSelectExisting={onSelectExisting}
    />
  );
};
