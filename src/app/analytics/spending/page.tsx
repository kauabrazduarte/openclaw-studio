"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, DollarSign } from "lucide-react";
import { getEvents } from "@/lib/analytics/tracker";

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "claude-opus-4": { input: 15, output: 75 },
  "claude-sonnet-4": { input: 3, output: 15 },
  "claude-haiku-4": { input: 0.8, output: 4 },
  default: { input: 3, output: 15 },
};

// Estimates per message_sent event
const EST_INPUT_TOKENS = 400;
const EST_OUTPUT_TOKENS = 1200;

function resolveModelKey(model: string): string {
  const lower = model.toLowerCase();
  for (const key of Object.keys(MODEL_PRICING)) {
    if (key === "default") continue;
    if (lower.includes(key)) return key;
  }
  return "default";
}

function formatCost(usd: number): string {
  if (usd < 0.001) return "<$0.001";
  if (usd < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}

export default function SpendingPage() {
  const events = useMemo(() => getEvents(), []);
  const messageSentEvents = useMemo(
    () => events.filter((e) => e.type === "message_sent"),
    [events]
  );

  const breakdown = useMemo(() => {
    const map = new Map<
      string,
      { modelKey: string; displayModel: string; count: number; cost: number }
    >();
    for (const e of messageSentEvents) {
      const modelKey = resolveModelKey(e.model ?? "");
      const pricing = MODEL_PRICING[modelKey] ?? MODEL_PRICING.default;
      const cost =
        (EST_INPUT_TOKENS / 1_000_000) * pricing.input +
        (EST_OUTPUT_TOKENS / 1_000_000) * pricing.output;
      const existing = map.get(modelKey);
      if (existing) {
        existing.count += 1;
        existing.cost += cost;
      } else {
        map.set(modelKey, {
          modelKey,
          displayModel: e.model ?? modelKey,
          count: 1,
          cost,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.cost - a.cost);
  }, [messageSentEvents]);

  const totalCost = useMemo(() => breakdown.reduce((acc, r) => acc + r.cost, 0), [breakdown]);
  const totalMessages = messageSentEvents.length;

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        {/* header */}
        <div className="mb-6 flex items-center gap-3">
          <Link href="/studio/analytics" className="ui-btn-icon ui-btn-icon-xs" aria-label="Back to analytics">
            <ArrowLeft className="h-3.5 w-3.5" />
          </Link>
          <div>
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">
              Analytics
            </div>
            <h1 className="mt-0.5 flex items-center gap-2 font-mono text-[18px] font-bold uppercase tracking-[0.08em] text-white/90">
              <DollarSign className="h-5 w-5" />
              Spending Estimates
            </h1>
          </div>
        </div>

        {/* disclaimer */}
        <div
          className="mb-6 rounded-lg border px-4 py-3"
          style={{ borderColor: "#3f3f46", background: "#18181b" }}
        >
          <p className="font-mono text-[11px] text-white/40">
            Estimates only. Calculated at ~{EST_INPUT_TOKENS} input tokens + ~{EST_OUTPUT_TOKENS}{" "}
            output tokens per message event. Actual costs depend on your real usage and model
            provider pricing.
          </p>
        </div>

        {/* totals */}
        <div className="mb-6 grid grid-cols-2 gap-3">
          <div className="ui-card px-4 py-3">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-white/35">
              Total estimated spend
            </p>
            <p className="mt-1 font-mono text-2xl font-bold text-white/90">
              {formatCost(totalCost)}
            </p>
          </div>
          <div className="ui-card px-4 py-3">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-white/35">
              Messages tracked
            </p>
            <p className="mt-1 font-mono text-2xl font-bold text-white/90">{totalMessages}</p>
          </div>
        </div>

        {/* breakdown by model */}
        {breakdown.length > 0 ? (
          <div className="ui-card overflow-hidden">
            <div className="border-b px-5 py-3" style={{ borderColor: "#27272a" }}>
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-white/40">
                Breakdown by model
              </p>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b text-left" style={{ borderColor: "#27272a" }}>
                  <th className="px-5 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-white/30">
                    Model
                  </th>
                  <th className="px-5 py-2 text-right font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-white/30">
                    Messages
                  </th>
                  <th className="px-5 py-2 text-right font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-white/30">
                    Est. cost
                  </th>
                </tr>
              </thead>
              <tbody>
                {breakdown.map((row) => (
                  <tr
                    key={row.modelKey}
                    className="border-b transition-colors hover:bg-white/3"
                    style={{ borderColor: "#1f1f1f" }}
                  >
                    <td className="px-5 py-2.5 font-mono text-[12px] text-white/70">
                      {row.displayModel}
                    </td>
                    <td className="px-5 py-2.5 text-right font-mono text-[13px] text-white/60">
                      {row.count}
                    </td>
                    <td className="px-5 py-2.5 text-right font-mono text-[13px] font-semibold text-white/80">
                      {formatCost(row.cost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="ui-card px-5 py-8 text-center">
            <p className="font-mono text-[12px] text-white/30">
              No spending data yet. Send some messages to track estimated costs.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
