import type { AgentState, FocusFilter } from "@/features/agents/state/store";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AgentAvatar } from "./AgentAvatar";
import {
  NEEDS_APPROVAL_BADGE_CLASS,
  resolveAgentStatusBadgeClass,
  resolveAgentStatusLabel,
} from "./colorSemantics";
import { EmptyStatePanel } from "./EmptyStatePanel";
import { Pencil, Plus, Search, Activity, Clock } from "lucide-react";

type FleetSidebarProps = {
  agents: AgentState[];
  selectedAgentId: string | null;
  filter: FocusFilter;
  onFilterChange: (next: FocusFilter) => void;
  onSelectAgent: (agentId: string) => void;
  onCreateAgent: () => void;
  createDisabled?: boolean;
  createBusy?: boolean;
  onEditAgent?: (agentId: string) => void;
};

const FILTER_OPTIONS: Array<{ value: FocusFilter; label: string; testId: string }> = [
  { value: "all", label: "All", testId: "fleet-filter-all" },
  { value: "running", label: "Running", testId: "fleet-filter-running" },
  { value: "approvals", label: "Approvals", testId: "fleet-filter-approvals" },
];

export const FleetSidebar = ({
  agents,
  selectedAgentId,
  filter,
  onFilterChange,
  onSelectAgent,
  onCreateAgent,
  createDisabled = false,
  createBusy = false,
  onEditAgent,
}: FleetSidebarProps) => {
  const rowRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const previousTopByAgentIdRef = useRef<Map<string, number>>(new Map());
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDescription, setSelectedDescription] = useState<string>("");

  useEffect(() => {
    if (!selectedAgentId) { setSelectedDescription(""); return; }
    try {
      setSelectedDescription(localStorage.getItem(`ocs_agent_desc_${selectedAgentId}`) ?? "");
    } catch {
      setSelectedDescription("");
    }
  }, [selectedAgentId]);

  const agentOrderKey = useMemo(() => agents.map((agent) => agent.agentId).join("|"), [agents]);

  useLayoutEffect(() => {
    const scroller = scrollContainerRef.current;
    if (!scroller) return;
    const scrollerRect = scroller.getBoundingClientRect();

    const getTopInScrollContent = (node: HTMLElement) =>
      node.getBoundingClientRect().top - scrollerRect.top + scroller.scrollTop;

    const nextTopByAgentId = new Map<string, number>();
    const agentIds = agentOrderKey.length === 0 ? [] : agentOrderKey.split("|");
    for (const agentId of agentIds) {
      const node = rowRefs.current.get(agentId);
      if (!node) continue;
      const nextTop = getTopInScrollContent(node);
      nextTopByAgentId.set(agentId, nextTop);
      const previousTop = previousTopByAgentIdRef.current.get(agentId);
      if (typeof previousTop !== "number") continue;
      const deltaY = previousTop - nextTop;
      if (Math.abs(deltaY) < 0.5) continue;
      if (typeof node.animate !== "function") continue;
      node.animate(
        [{ transform: `translateY(${deltaY}px)` }, { transform: "translateY(0px)" }],
        { duration: 260, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }
      );
    }
    previousTopByAgentIdRef.current = nextTopByAgentId;
  }, [agentOrderKey]);

  const runningCount = useMemo(
    () => agents.filter((a) => a.status === "running").length,
    [agents]
  );
  const approvalCount = useMemo(
    () => agents.filter((a) => a.awaitingUserInput).length,
    [agents]
  );

  const filteredAgents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return agents;
    return agents.filter((a) => a.name.toLowerCase().includes(q));
  }, [agents, searchQuery]);

  return (
    <aside
      className="fade-up-delay relative flex h-full w-full min-w-64 flex-col bg-sidebar xl:max-w-[300px] xl:border-r xl:border-sidebar-border"
      data-testid="fleet-sidebar"
      style={{ borderRight: "1px solid #141414" }}
    >
      {/* header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] font-semibold tracking-[0.08em] text-white/40 uppercase">
            Agents
          </span>
          <span className="font-mono text-[11px] text-white/25">{agents.length}</span>
        </div>
        <button
          type="button"
          data-testid="fleet-new-agent-button"
          className="ui-btn-icon ui-btn-icon-xs border border-white/10 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/90 transition-colors"
          onClick={onCreateAgent}
          disabled={createDisabled || createBusy}
          title="New agent"
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="sr-only">{createBusy ? "Creating..." : "New agent"}</span>
        </button>
      </div>

      {/* stat chips */}
      {(runningCount > 0 || approvalCount > 0) && (
        <div className="flex items-center gap-1.5 px-4 pb-2">
          {runningCount > 0 && (
            <span className="agent-stat-chip agent-stat-chip--running">
              <Activity className="h-2.5 w-2.5" />
              {runningCount} running
            </span>
          )}
          {approvalCount > 0 && (
            <span className="agent-stat-chip agent-stat-chip--approval">
              <Clock className="h-2.5 w-2.5" />
              {approvalCount} pending
            </span>
          )}
        </div>
      )}

      {/* search */}
      <div className="relative px-3 pb-2">
        <Search
          className="absolute left-5.5 top-1/2 h-3 w-3 -translate-y-1/2 text-white/20 pointer-events-none"
          style={{ left: "22px" }}
        />
        <input
          type="text"
          placeholder="Search agents..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="sidebar-search-input"
          spellCheck={false}
        />
      </div>

      {/* filter pills */}
      <div className="flex items-center gap-1 px-3 pb-2">
        {FILTER_OPTIONS.map((option) => {
          const active = filter === option.value;
          return (
            <button
              key={option.value}
              type="button"
              data-testid={option.testId}
              aria-pressed={active}
              className={`rounded-md px-2.5 py-1 font-mono text-[11px] font-medium tracking-[0.04em] transition-colors ${
                active
                  ? "bg-white/10 text-white/80"
                  : "text-white/30 hover:text-white/60 hover:bg-white/5"
              }`}
              onClick={() => onFilterChange(option.value)}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {/* divider */}
      <div className="mx-3 border-t border-white/5" />

      {/* agent list */}
      <div ref={scrollContainerRef} className="ui-scroll min-h-0 flex-1 overflow-auto p-2">
        {filteredAgents.length === 0 ? (
          searchQuery ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Search className="mb-2 h-5 w-5 text-white/15" />
              <p className="text-xs text-white/30">No agents match &ldquo;{searchQuery}&rdquo;</p>
            </div>
          ) : (
            <EmptyStatePanel title="No agents available." compact className="p-3 text-xs" />
          )
        ) : (
          <div className="flex flex-col gap-1">
            {filteredAgents.map((agent) => {
              const selected = selectedAgentId === agent.agentId;
              const avatarSeed = agent.avatarSeed ?? agent.agentId;
              return (
                <button
                  key={agent.agentId}
                  ref={(node) => {
                    if (node) {
                      rowRefs.current.set(agent.agentId, node);
                      return;
                    }
                    rowRefs.current.delete(agent.agentId);
                  }}
                  type="button"
                  data-testid={`fleet-agent-row-${agent.agentId}`}
                  className={`group relative flex w-full items-center gap-2.5 overflow-hidden rounded-lg border px-2.5 py-2 text-left transition-all duration-150 ${
                    selected
                      ? "border-white/15 bg-white/7"
                      : "border-transparent hover:border-white/8 hover:bg-white/4"
                  }`}
                  style={selected ? { background: "rgba(255,255,255,0.06)" } : undefined}
                  onClick={() => onSelectAgent(agent.agentId)}
                >
                  {selected && (
                    <span
                      aria-hidden="true"
                      className="ui-card-select-indicator"
                    />
                  )}
                  <AgentAvatar
                    seed={avatarSeed}
                    name={agent.name}
                    avatarUrl={agent.avatarUrl ?? null}
                    size={36}
                    isSelected={selected}
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate text-[13px] font-medium leading-tight ${
                        selected ? "text-white/95" : "text-white/70"
                      }`}
                    >
                      {agent.name}
                    </p>
                    {selected && selectedDescription ? (
                      <p className="mt-0.5 line-clamp-2 text-[10px] leading-tight text-white/40">
                        {selectedDescription}
                      </p>
                    ) : null}
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span
                        className={`ui-badge ${resolveAgentStatusBadgeClass(agent.status)}`}
                        data-status={agent.status}
                      >
                        {resolveAgentStatusLabel(agent.status)}
                      </span>
                      {agent.awaitingUserInput ? (
                        <span
                          className={`ui-badge ${NEEDS_APPROVAL_BADGE_CLASS}`}
                          data-status="approval"
                        >
                          Needs approval
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {onEditAgent ? (
                    <button
                      type="button"
                      className="ui-btn-icon ui-btn-icon-xs shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                      aria-label={`Edit ${agent.name}`}
                      title="Edit agent"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditAgent(agent.agentId);
                      }}
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
};
