"use client";

import { useMemo, useState } from "react";
import type { AgentState } from "@/features/agents/state/store";
import type { GatewayStatus } from "@/lib/gateway/gateway-status";
import { AgentAvatar } from "./AgentAvatar";
import {
  resolveAgentStatusBadgeClass,
  resolveAgentStatusLabel,
  resolveGatewayStatusBadgeClass,
  resolveGatewayStatusLabel,
} from "./colorSemantics";
import { Settings, Plus, Zap, Search } from "lucide-react";

type HomeScreenProps = {
  agents: AgentState[];
  gatewayStatus: GatewayStatus;
  onSelectAgent: (agentId: string) => void;
  onCreateAgent: () => void;
  onOpenSettings: () => void;
};

function formatRelativeTime(ms: number): string {
  if (!ms) return "nunca";
  const diffMs = Date.now() - ms;
  if (diffMs < 60_000) return "agora mesmo";
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}min atrás`;
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}h atrás`;
  return `${Math.floor(diffMs / 86_400_000)}d atrás`;
}

function resolveGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export const HomeScreen = ({
  agents,
  gatewayStatus,
  onSelectAgent,
  onCreateAgent,
  onOpenSettings,
}: HomeScreenProps) => {
  const [searchQuery, setSearchQuery] = useState("");

  const runningCount = useMemo(
    () => agents.filter((a) => a.status === "running").length,
    [agents]
  );
  const pendingCount = useMemo(
    () => agents.filter((a) => a.awaitingUserInput).length,
    [agents]
  );
  const greeting = useMemo(() => resolveGreeting(), []);
  const isConnecting =
    gatewayStatus === "connecting" || gatewayStatus === "reconnecting";
  const isConnected = gatewayStatus === "connected";

  const filteredAgents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return agents;
    return agents.filter((a) => a.name.toLowerCase().includes(q));
  }, [agents, searchQuery]);

  return (
    <div className="flex h-full w-full flex-col overflow-auto bg-background">
      {/* barra superior */}
      <div
        className="flex h-11 shrink-0 items-center justify-between border-b px-5"
        style={{ borderColor: "#27272a" }}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">🐉</span>
          <span className="font-mono text-[12px] font-semibold uppercase tracking-widest text-white/80">
            OpenClaw Draak
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`ui-chip px-2.5 py-0.5 font-mono text-[10px] font-semibold tracking-[0.08em] ${resolveGatewayStatusBadgeClass(gatewayStatus)}`}
          >
            <span className="flex items-center gap-1.5">
              {isConnected && (
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
              )}
              {isConnecting && (
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
              )}
              {resolveGatewayStatusLabel(gatewayStatus)}
            </span>
          </span>
          <button
            type="button"
            className="ui-btn-icon ui-btn-icon-xs"
            onClick={onOpenSettings}
            title="Configurações"
            aria-label="Abrir configurações"
          >
            <Settings className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* área de boas-vindas */}
      <div className="shrink-0 px-6 pt-8 pb-3">
        <p className="font-mono text-[12px] text-white/35 uppercase tracking-[0.1em]">
          {greeting},
        </p>
        <h1 className="mt-1 text-[22px] font-semibold text-white/90">operador.</h1>
        <p className="mt-2 font-mono text-[11px] text-white/30 leading-relaxed max-w-sm">
          Selecione um agente abaixo para abrir o chat, ou crie um novo. Os agentes rodam de forma autônoma e se conectam pelo gateway OpenClaw.
        </p>
      </div>

      {/* estatísticas rápidas */}
      <div className="flex shrink-0 flex-wrap items-center gap-2.5 px-6 pb-5">
        <div className="ui-card flex items-center gap-2 px-3.5 py-2">
          <span className="font-mono text-base font-bold text-white/90">{agents.length}</span>
          <span className="font-mono text-[10px] text-white/35 uppercase tracking-[0.06em]">
            agentes
          </span>
        </div>
        <div className="ui-card flex items-center gap-2 px-3.5 py-2">
          <span
            className={`font-mono text-base font-bold ${runningCount > 0 ? "text-green-400" : "text-white/90"}`}
          >
            {runningCount}
          </span>
          <span className="font-mono text-[10px] text-white/35 uppercase tracking-[0.06em]">
            em execução
          </span>
        </div>
        {pendingCount > 0 && (
          <div className="ui-card flex items-center gap-2 px-3.5 py-2">
            <span className="font-mono text-base font-bold text-yellow-400">{pendingCount}</span>
            <span className="font-mono text-[10px] text-white/35 uppercase tracking-[0.06em]">
              pendente
            </span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <Zap className={`h-3.5 w-3.5 ${isConnected ? "text-emerald-400" : "text-white/20"}`} />
          <span className="font-mono text-[10px] text-white/30">
            {isConnected ? "Gateway conectado" : isConnecting ? "Conectando…" : "Gateway offline"}
          </span>
        </div>
      </div>

      {/* busca */}
      <div className="relative shrink-0 px-6 pb-4">
        <Search
          className="absolute left-9 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/20 pointer-events-none"
        />
        <input
          type="text"
          placeholder="Buscar agentes…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="sidebar-search-input w-full pl-8"
          spellCheck={false}
        />
      </div>

      {/* grade de agentes */}
      <div className="flex-1 px-6 pb-8">
        {agents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="text-5xl">🐉</span>
            <p className="mt-4 font-mono text-[13px] text-white/40">Nenhum agente ainda.</p>
            <button
              type="button"
              className="ui-btn-primary mt-4 px-5 py-2.5 font-mono text-[12px] font-medium tracking-[0.04em]"
              onClick={onCreateAgent}
            >
              Criar primeiro agente
            </button>
          </div>
        ) : filteredAgents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Search className="mb-3 h-6 w-6 text-white/15" />
            <p className="font-mono text-[12px] text-white/30">
              Nenhum agente encontrado para &ldquo;{searchQuery}&rdquo;
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredAgents.map((agent, index) => {
              const avatarSeed = agent.avatarSeed ?? agent.agentId;
              const activityAt = agent.lastActivityAt ?? agent.runStartedAt ?? null;
              return (
                <button
                  key={agent.agentId}
                  type="button"
                  className="home-agent-card stagger-item flex flex-col items-center gap-3 p-5 text-left"
                  style={{ animationDelay: `${index * 40}ms` }}
                  onClick={() => onSelectAgent(agent.agentId)}
                >
                  <AgentAvatar
                    seed={avatarSeed}
                    name={agent.name}
                    avatarUrl={agent.avatarUrl ?? null}
                    size={64}
                    isSelected={false}
                  />
                  <div className="w-full min-w-0 text-center">
                    <p className="truncate text-[13px] font-semibold text-white/90">
                      {agent.name}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1.5">
                      <span
                        className={`ui-badge ${resolveAgentStatusBadgeClass(agent.status)}`}
                      >
                        {resolveAgentStatusLabel(agent.status)}
                      </span>
                    </div>
                    {agent.model ? (
                      <p className="mt-1.5 font-mono text-[10px] text-white/25 truncate">
                        {agent.model}
                      </p>
                    ) : null}
                    {activityAt ? (
                      <p className="mt-0.5 font-mono text-[10px] text-white/20">
                        {formatRelativeTime(activityAt)}
                      </p>
                    ) : null}
                  </div>
                  <span className="mt-auto font-mono text-[11px] font-medium text-white/40">
                    Abrir →
                  </span>
                </button>
              );
            })}
            {/* card novo agente */}
            <button
              type="button"
              className="home-agent-card home-agent-card--new stagger-item flex flex-col items-center justify-center gap-3 p-5"
              style={{ animationDelay: `${filteredAgents.length * 40}ms`, minHeight: 180 }}
              onClick={onCreateAgent}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-dashed border-white/20">
                <Plus className="h-5 w-5 text-white/40" />
              </div>
              <span className="font-mono text-[12px] text-white/40">Novo agente</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
