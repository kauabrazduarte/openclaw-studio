export const buildAgentMainSessionKey = (agentId: string, mainKey: string) => {
  const trimmedAgent = agentId.trim();
  const trimmedKey = mainKey.trim() || "main";
  return `agent:${trimmedAgent}:${trimmedKey}`;
};

export const buildAgentStudioSessionKey = (agentId: string, sessionId: string) => {
  const trimmedAgent = agentId.trim();
  const trimmedSession = sessionId.trim();
  return `agent:${trimmedAgent}:studio:${trimmedSession}`;
};

export const parseAgentIdFromSessionKey = (sessionKey: string): string | null => {
  const match = sessionKey.match(/^agent:([^:]+):/);
  return match ? match[1] : null;
};

export const isSameSessionKey = (a: string, b: string) => {
  const left = a.trim();
  const right = b.trim();
  return left.length > 0 && left === right;
};

type SessionListEntry = {
  key?: string;
  updatedAt?: number | null;
};

export type StudioSessionEntry = {
  key: string;
  sessionId: string;
  updatedAt: number;
};

export type StudioSessionsForAgent = {
  agentId: string;
  entries: StudioSessionEntry[];
};

export type StudioSessionSelection = {
  sessionId: string;
  hasPersistedSession: boolean;
  shouldPersistSession: boolean;
  existingSessionKeys: string[];
  staleStudioKeys: string[];
};

export const extractStudioSessionEntries = (
  agentId: string,
  sessions: SessionListEntry[]
): StudioSessionEntry[] => {
  const prefix = `agent:${agentId.trim()}:studio:`;
  return sessions
    .map((entry): StudioSessionEntry | null => {
      const key = typeof entry.key === "string" ? entry.key.trim() : "";
      if (!key || !key.startsWith(prefix)) return null;
      const sessionId = key.slice(prefix.length).trim();
      if (!sessionId) return null;
      const updatedAt = typeof entry.updatedAt === "number" ? entry.updatedAt : 0;
      return { key, sessionId, updatedAt };
    })
    .filter((entry): entry is StudioSessionEntry => Boolean(entry))
    .sort((a, b) => b.updatedAt - a.updatedAt);
};

export const reconcileStudioSessionSelection = (params: {
  studioSessionsByAgent: StudioSessionsForAgent[];
  persistedSessionId?: string | null;
  generatedSessionId: string;
}): StudioSessionSelection => {
  const { studioSessionsByAgent, persistedSessionId, generatedSessionId } = params;
  const allStudioSessions = studioSessionsByAgent
    .flatMap((group) => group.entries)
    .sort((a, b) => b.updatedAt - a.updatedAt);
  const persisted = persistedSessionId?.trim() ?? "";
  const hadPersistedSession = persisted.length > 0;
  let sessionId = persisted;
  const hasPersistedSession =
    sessionId.length > 0 && allStudioSessions.some((entry) => entry.sessionId === sessionId);
  if (!sessionId || (allStudioSessions.length > 0 && !hasPersistedSession)) {
    sessionId = allStudioSessions[0]?.sessionId ?? generatedSessionId.trim();
  }
  const existingSessionKeys: string[] = [];
  const staleStudioKeys: string[] = [];
  const staleStudioSet = new Set<string>();
  for (const group of studioSessionsByAgent) {
    const active = group.entries.find((entry) => entry.sessionId === sessionId);
    if (!active) continue;
    existingSessionKeys.push(active.key);
    for (const entry of group.entries) {
      if (entry.key === active.key || staleStudioSet.has(entry.key)) continue;
      staleStudioSet.add(entry.key);
      staleStudioKeys.push(entry.key);
    }
  }
  return {
    sessionId,
    hasPersistedSession,
    shouldPersistSession: !hadPersistedSession || !hasPersistedSession,
    existingSessionKeys,
    staleStudioKeys,
  };
};
