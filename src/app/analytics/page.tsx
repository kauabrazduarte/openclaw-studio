"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, BarChart2 } from "lucide-react";
import { getEvents, type AnalyticsEvent } from "@/lib/analytics/tracker";

const DAY_MS = 86_400_000;

function formatDay(ts: number): string {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(
    new Date(ts)
  );
}

function groupByDay(events: AnalyticsEvent[], days: number): { label: string; count: number }[] {
  const now = Date.now();
  return Array.from({ length: days }, (_, i) => {
    const dayStart = now - (days - 1 - i) * DAY_MS;
    const label = formatDay(dayStart);
    const count = events.filter((e) => {
      const diff = e.timestamp - dayStart;
      return diff >= 0 && diff < DAY_MS;
    }).length;
    return { label, count };
  });
}

function groupByAgent(
  events: AnalyticsEvent[]
): { agentId: string; agentName: string; count: number }[] {
  const map = new Map<string, { agentName: string; count: number }>();
  for (const e of events) {
    if (e.type !== "message_sent") continue;
    const entry = map.get(e.agentId);
    if (entry) {
      entry.count += 1;
    } else {
      map.set(e.agentId, { agentName: e.agentName, count: 1 });
    }
  }
  return Array.from(map.entries())
    .map(([agentId, { agentName, count }]) => ({ agentId, agentName, count }))
    .sort((a, b) => b.count - a.count);
}

function resolveMostUsedModel(events: AnalyticsEvent[]): string {
  const map = new Map<string, number>();
  for (const e of events) {
    if (!e.model) continue;
    map.set(e.model, (map.get(e.model) ?? 0) + 1);
  }
  if (map.size === 0) return "—";
  let best = "";
  let bestCount = 0;
  for (const [model, count] of map.entries()) {
    if (count > bestCount) {
      best = model;
      bestCount = count;
    }
  }
  return best || "—";
}

export default function AnalyticsPage() {
  const events = useMemo(() => getEvents(), []);

  const totalEvents = events.length;
  const uniqueAgentIds = useMemo(() => new Set(events.map((e) => e.agentId)).size, [events]);
  const eventsToday = useMemo(() => {
    const dayStart = Date.now() - (Date.now() % DAY_MS);
    return events.filter((e) => e.timestamp >= dayStart).length;
  }, [events]);
  const mostUsedModel = useMemo(() => resolveMostUsedModel(events), [events]);

  const dailyCounts = useMemo(() => groupByDay(events, 7), [events]);
  const maxDailyCount = useMemo(
    () => Math.max(...dailyCounts.map((d) => d.count), 1),
    [dailyCounts]
  );
  const agentBreakdown = useMemo(() => groupByAgent(events), [events]);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        {/* back */}
        <div className="mb-6 flex items-center gap-3">
          <Link
            href="/"
            className="ui-btn-icon ui-btn-icon-xs"
            aria-label="Back to studio"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </Link>
          <div>
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">
              OpenClaw Studio
            </div>
            <h1 className="mt-0.5 flex items-center gap-2 font-mono text-[18px] font-bold uppercase tracking-[0.08em] text-white/90">
              <BarChart2 className="h-5 w-5" />
              Analytics
            </h1>
          </div>
        </div>

        {/* stat cards */}
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Total events", value: totalEvents },
            { label: "Unique agents", value: uniqueAgentIds },
            { label: "Events today", value: eventsToday },
            { label: "Top model", value: mostUsedModel, mono: true },
          ].map(({ label, value, mono }) => (
            <div key={label} className="ui-card px-4 py-3">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-white/35">
                {label}
              </p>
              <p
                className={`mt-1 text-xl font-bold text-white/90 ${mono ? "font-mono text-[13px] break-all" : ""}`}
              >
                {value}
              </p>
            </div>
          ))}
        </div>

        {/* bar chart: messages per day */}
        <div className="ui-card mb-8 px-5 py-4">
          <p className="mb-4 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-white/40">
            Messages per day (last 7 days)
          </p>
          <svg
            width="100%"
            viewBox="0 0 560 120"
            preserveAspectRatio="none"
            aria-label="Messages per day bar chart"
            style={{ height: 120 }}
          >
            {dailyCounts.map((day, i) => {
              const barWidth = 52;
              const gap = 28;
              const x = i * (barWidth + gap) + 14;
              const maxH = 80;
              const h = Math.max(2, (day.count / maxDailyCount) * maxH);
              const y = maxH - h + 10;
              return (
                <g key={day.label}>
                  <rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={h}
                    rx={4}
                    fill={day.count > 0 ? "#4ade80" : "#3f3f46"}
                  />
                  <text
                    x={x + barWidth / 2}
                    y={y - 4}
                    textAnchor="middle"
                    fontSize={9}
                    fill="#71717a"
                    fontFamily="monospace"
                  >
                    {day.count > 0 ? day.count : ""}
                  </text>
                  <text
                    x={x + barWidth / 2}
                    y={108}
                    textAnchor="middle"
                    fontSize={9}
                    fill="#52525b"
                    fontFamily="monospace"
                  >
                    {day.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* agent breakdown table */}
        {agentBreakdown.length > 0 ? (
          <div className="ui-card mb-8 overflow-hidden">
            <div className="border-b px-5 py-3" style={{ borderColor: "#27272a" }}>
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-white/40">
                Agents by message count
              </p>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b text-left" style={{ borderColor: "#27272a" }}>
                  <th className="px-5 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-white/30">
                    Agent
                  </th>
                  <th className="px-5 py-2 text-right font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-white/30">
                    Messages
                  </th>
                </tr>
              </thead>
              <tbody>
                {agentBreakdown.map((row) => (
                  <tr
                    key={row.agentId}
                    className="border-b transition-colors hover:bg-white/3"
                    style={{ borderColor: "#1f1f1f" }}
                  >
                    <td className="px-5 py-2.5 text-[13px] text-white/75">{row.agentName}</td>
                    <td className="px-5 py-2.5 text-right font-mono text-[13px] font-semibold text-white/75">
                      {row.count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="ui-card mb-8 px-5 py-8 text-center">
            <p className="font-mono text-[12px] text-white/30">
              No message events recorded yet.
            </p>
          </div>
        )}

        {/* link to spending */}
        <div className="flex justify-end">
          <Link
            href="/analytics/spending"
            className="ui-btn-secondary px-4 py-2 font-mono text-[12px] font-medium tracking-[0.04em]"
          >
            View spending estimates →
          </Link>
        </div>
      </div>
    </div>
  );
}
