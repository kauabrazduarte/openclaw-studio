"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  Cpu,
  Database,
  HardDrive,
  MemoryStick,
  Server,
  Zap,
} from "lucide-react";
import { getEvents } from "@/lib/analytics/tracker";

type SystemMetrics = {
  timestamp: number;
  cpu: { percent: number; cores: number; model: string };
  memory: { total: number; used: number; free: number; percent: number };
  disk: { used: number; total: number; percent: number; mountpoint: string };
  load: [number, number, number];
  uptime: number;
  platform: string;
  hostname: string;
  processes: Array<{ name: string; cpu: number; mem: number; pid: number }>;
  gateway: { up: boolean; pid?: number };
};

function formatBytes(b: number) {
  if (b >= 1e9) return `${(b / 1e9).toFixed(1)} GB`;
  if (b >= 1e6) return `${(b / 1e6).toFixed(1)} MB`;
  return `${(b / 1e3).toFixed(0)} KB`;
}

function formatUptime(s: number) {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(" ");
}

function GaugeBar({ percent, color = "#4ade80" }: { percent: number; color?: string }) {
  const clamped = Math.min(100, Math.max(0, percent));
  const barColor = clamped > 85 ? "#f87171" : clamped > 65 ? "#fbbf24" : color;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/8">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${clamped}%`, background: barColor }}
      />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  gauge,
  gaugeColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  gauge?: number;
  gaugeColor?: string;
}) {
  return (
    <div className="ui-card flex flex-col gap-2 px-4 py-3">
      <div className="flex items-center gap-2 text-white/40">
        {icon}
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em]">
          {label}
        </span>
      </div>
      <div className="text-xl font-bold text-white/90">{value}</div>
      {gauge !== undefined && <GaugeBar percent={gauge} color={gaugeColor} />}
      {sub && (
        <div className="font-mono text-[10px] text-white/35">{sub}</div>
      )}
    </div>
  );
}

const DAY_MS = 86_400_000;

export default function AnalyticsPage() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchMetrics = async () => {
    try {
      const res = await fetch("/api/metrics/system");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as SystemMetrics;
      setMetrics(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch metrics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchMetrics();
    intervalRef.current = setInterval(() => void fetchMetrics(), 4000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Agent activity from localStorage
  const events = useMemo(() => getEvents(), []);
  const eventsToday = useMemo(() => {
    const dayStart = Date.now() - (Date.now() % DAY_MS);
    return events.filter((e) => e.timestamp >= dayStart).length;
  }, [events]);
  const uniqueAgents = useMemo(
    () => new Set(events.map((e) => e.agentId)).size,
    [events]
  );

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        {/* header */}
        <div className="mb-6 flex items-center gap-3">
          <Link href="/" className="ui-btn-icon ui-btn-icon-xs" aria-label="Back">
            <ArrowLeft className="h-3.5 w-3.5" />
          </Link>
          <div>
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-white/30">
              OpenClaw Studio
            </div>
            <h1 className="mt-0.5 font-mono text-[18px] font-bold uppercase tracking-[0.08em] text-white/90 flex items-center gap-2">
              <Activity className="h-5 w-5" /> System Monitor
            </h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {metrics && (
              <span className="font-mono text-[10px] text-white/30">
                Updated {new Date(metrics.timestamp).toLocaleTimeString()}
              </span>
            )}
            <span
              className={`h-2 w-2 rounded-full ${loading ? "bg-amber-400 animate-pulse" : "bg-emerald-400"}`}
            />
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 font-mono text-[12px] text-red-400">
            {error}
          </div>
        )}

        {/* OpenClaw + host info */}
        {metrics && (
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/4 px-3 py-1.5">
              <Server className="h-3.5 w-3.5 text-white/40" />
              <span className="font-mono text-[11px] text-white/60">{metrics.hostname}</span>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/4 px-3 py-1.5">
              <span className="font-mono text-[11px] text-white/40">uptime</span>
              <span className="font-mono text-[11px] text-white/70">{formatUptime(metrics.uptime)}</span>
            </div>
            <div
              className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 ${
                metrics.gateway.up
                  ? "border-emerald-500/30 bg-emerald-500/10"
                  : "border-red-500/30 bg-red-500/10"
              }`}
            >
              <Zap className={`h-3.5 w-3.5 ${metrics.gateway.up ? "text-emerald-400" : "text-red-400"}`} />
              <span
                className={`font-mono text-[11px] ${metrics.gateway.up ? "text-emerald-300" : "text-red-400"}`}
              >
                Gateway {metrics.gateway.up ? "online" : "offline"}
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/4 px-3 py-1.5">
              <span className="font-mono text-[11px] text-white/40">load</span>
              <span className="font-mono text-[11px] text-white/70">
                {metrics.load.map((l) => l.toFixed(2)).join(" · ")}
              </span>
            </div>
          </div>
        )}

        {/* system stat cards */}
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3">
          <StatCard
            icon={<Cpu className="h-3.5 w-3.5" />}
            label="CPU"
            value={metrics ? `${metrics.cpu.percent}%` : "—"}
            sub={metrics ? `${metrics.cpu.cores} cores · ${metrics.cpu.model.split("@")[0].trim().slice(0, 24)}` : undefined}
            gauge={metrics?.cpu.percent}
          />
          <StatCard
            icon={<MemoryStick className="h-3.5 w-3.5" />}
            label="Memory"
            value={metrics ? `${metrics.memory.percent}%` : "—"}
            sub={metrics ? `${formatBytes(metrics.memory.used)} / ${formatBytes(metrics.memory.total)}` : undefined}
            gauge={metrics?.memory.percent}
            gaugeColor="#60a5fa"
          />
          <StatCard
            icon={<HardDrive className="h-3.5 w-3.5" />}
            label="Disk"
            value={metrics ? `${metrics.disk.percent}%` : "—"}
            sub={metrics ? `${formatBytes(metrics.disk.used)} / ${formatBytes(metrics.disk.total)}` : undefined}
            gauge={metrics?.disk.percent}
            gaugeColor="#c084fc"
          />
          <StatCard
            icon={<Database className="h-3.5 w-3.5" />}
            label="Messages today"
            value={String(eventsToday)}
            sub={`${uniqueAgents} active agent${uniqueAgents !== 1 ? "s" : ""}`}
          />
          <StatCard
            icon={<Zap className="h-3.5 w-3.5" />}
            label="Gateway"
            value={metrics ? (metrics.gateway.up ? "Online" : "Offline") : "—"}
            sub={metrics?.gateway.pid ? `PID ${metrics.gateway.pid}` : undefined}
          />
          <StatCard
            icon={<Activity className="h-3.5 w-3.5" />}
            label="Total events"
            value={String(events.length)}
            sub={`All time`}
          />
        </div>

        {/* process table */}
        {metrics && metrics.processes.length > 0 && (
          <div className="ui-card mb-6 overflow-hidden">
            <div className="flex items-center gap-2 border-b px-5 py-3" style={{ borderColor: "#27272a" }}>
              <Activity className="h-3.5 w-3.5 text-white/40" />
              <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-white/40">
                Top Processes
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left" style={{ borderColor: "#1f1f1f" }}>
                    {["PID", "Name", "CPU %", "MEM %"].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-white/25"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {metrics.processes.map((p) => (
                    <tr
                      key={p.pid}
                      className="border-b transition-colors hover:bg-white/3"
                      style={{ borderColor: "#181818" }}
                    >
                      <td className="px-4 py-2 font-mono text-[11px] text-white/30">{p.pid}</td>
                      <td className="px-4 py-2 font-mono text-[12px] text-white/75 max-w-[160px] truncate">
                        {p.name}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <div className="h-1 w-16 overflow-hidden rounded-full bg-white/8">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.min(100, p.cpu * 4)}%`,
                                background: p.cpu > 20 ? "#fbbf24" : "#4ade80",
                              }}
                            />
                          </div>
                          <span className="font-mono text-[11px] text-white/60">{p.cpu.toFixed(1)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2 font-mono text-[11px] text-white/60">
                        {p.mem.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

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
