const STORAGE_KEY = "ocs_analytics_v1";
const MAX_EVENTS = 2000;
const PRUNE_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export type AnalyticsEvent = {
  id: string;
  type: "message_sent" | "agent_created" | "session_reset" | "error";
  agentId: string;
  agentName: string;
  model?: string;
  timestamp: number;
};

function readAll(): AnalyticsEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AnalyticsEvent[]) : [];
  } catch {
    return [];
  }
}

function writeAll(events: AnalyticsEvent[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  } catch {
    // storage full — ignore
  }
}

export function trackEvent(
  event: Omit<AnalyticsEvent, "id" | "timestamp">
): void {
  const events = readAll();
  const newEvent: AnalyticsEvent = {
    ...event,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
  };
  const next = [...events, newEvent];
  // Trim to max events (keep most recent)
  const trimmed = next.length > MAX_EVENTS ? next.slice(next.length - MAX_EVENTS) : next;
  writeAll(trimmed);
}

export function getEvents(): AnalyticsEvent[] {
  return readAll();
}

export function clearOldEvents(): void {
  const cutoff = Date.now() - PRUNE_AGE_MS;
  const events = readAll().filter((e) => e.timestamp >= cutoff);
  writeAll(events);
}
