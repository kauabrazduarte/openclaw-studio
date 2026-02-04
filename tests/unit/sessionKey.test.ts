import { describe, expect, it } from "vitest";

import {
  extractStudioSessionEntries,
  reconcileStudioSessionSelection,
  buildAgentMainSessionKey,
  isSameSessionKey,
  parseAgentIdFromSessionKey,
} from "@/lib/gateway/sessionKeys";

describe("sessionKey helpers", () => {
  it("buildAgentMainSessionKey formats agent session key", () => {
    expect(buildAgentMainSessionKey("agent-1", "main")).toBe("agent:agent-1:main");
  });

  it("parseAgentIdFromSessionKey extracts agent id", () => {
    expect(parseAgentIdFromSessionKey("agent:agent-1:main")).toBe("agent-1");
  });

  it("parseAgentIdFromSessionKey returns null when missing", () => {
    expect(parseAgentIdFromSessionKey("")).toBeNull();
  });

  it("isSameSessionKey requires exact session key match", () => {
    expect(isSameSessionKey("agent:main:studio:one", "agent:main:studio:one")).toBe(true);
    expect(isSameSessionKey("agent:main:studio:one", "agent:main:discord:one")).toBe(false);
  });

  it("isSameSessionKey trims whitespace", () => {
    expect(isSameSessionKey(" agent:main:studio:one ", "agent:main:studio:one")).toBe(true);
  });

  it("extractStudioSessionEntries filters non-studio keys and sorts newest first", () => {
    const entries = extractStudioSessionEntries("agent-1", [
      { key: "agent:agent-1:studio:session-a", updatedAt: 10 },
      { key: "agent:agent-2:studio:session-b", updatedAt: 99 },
      { key: "agent:agent-1:main", updatedAt: 77 },
      { key: "agent:agent-1:studio: session-c ", updatedAt: 25 },
      { key: "agent:agent-1:studio:", updatedAt: 30 },
      { key: "", updatedAt: 40 },
      { key: "agent:agent-1:studio:session-d" },
    ]);

    expect(entries).toEqual([
      { key: "agent:agent-1:studio: session-c", sessionId: "session-c", updatedAt: 25 },
      { key: "agent:agent-1:studio:session-a", sessionId: "session-a", updatedAt: 10 },
      { key: "agent:agent-1:studio:session-d", sessionId: "session-d", updatedAt: 0 },
    ]);
  });

  it("reconcileStudioSessionSelection keeps a persisted session when present", () => {
    const result = reconcileStudioSessionSelection({
      studioSessionsByAgent: [
        {
          agentId: "agent-1",
          entries: [
            { key: "agent:agent-1:studio:session-a", sessionId: "session-a", updatedAt: 10 },
            { key: "agent:agent-1:studio:session-old", sessionId: "session-old", updatedAt: 5 },
          ],
        },
        {
          agentId: "agent-2",
          entries: [
            { key: "agent:agent-2:studio:session-a", sessionId: "session-a", updatedAt: 9 },
            { key: "agent:agent-2:studio:session-other", sessionId: "session-other", updatedAt: 8 },
          ],
        },
      ],
      persistedSessionId: "session-a",
      generatedSessionId: "generated-session",
    });

    expect(result.sessionId).toBe("session-a");
    expect(result.hasPersistedSession).toBe(true);
    expect(result.shouldPersistSession).toBe(false);
    expect(result.existingSessionKeys).toEqual([
      "agent:agent-1:studio:session-a",
      "agent:agent-2:studio:session-a",
    ]);
    expect(result.staleStudioKeys).toEqual([
      "agent:agent-1:studio:session-old",
      "agent:agent-2:studio:session-other",
    ]);
  });

  it("reconcileStudioSessionSelection falls back to newest known session when persisted is stale", () => {
    const result = reconcileStudioSessionSelection({
      studioSessionsByAgent: [
        {
          agentId: "agent-1",
          entries: [
            { key: "agent:agent-1:studio:newest", sessionId: "newest", updatedAt: 100 },
          ],
        },
        {
          agentId: "agent-2",
          entries: [
            { key: "agent:agent-2:studio:older", sessionId: "older", updatedAt: 90 },
          ],
        },
      ],
      persistedSessionId: "missing-session",
      generatedSessionId: "generated-session",
    });

    expect(result.sessionId).toBe("newest");
    expect(result.hasPersistedSession).toBe(false);
    expect(result.shouldPersistSession).toBe(true);
    expect(result.existingSessionKeys).toEqual(["agent:agent-1:studio:newest"]);
    expect(result.staleStudioKeys).toEqual([]);
  });

  it("reconcileStudioSessionSelection uses generated session when no studio sessions exist", () => {
    const result = reconcileStudioSessionSelection({
      studioSessionsByAgent: [
        { agentId: "agent-1", entries: [] },
        { agentId: "agent-2", entries: [] },
      ],
      persistedSessionId: null,
      generatedSessionId: "generated-session",
    });

    expect(result.sessionId).toBe("generated-session");
    expect(result.hasPersistedSession).toBe(false);
    expect(result.shouldPersistSession).toBe(true);
    expect(result.existingSessionKeys).toEqual([]);
    expect(result.staleStudioKeys).toEqual([]);
  });
});
