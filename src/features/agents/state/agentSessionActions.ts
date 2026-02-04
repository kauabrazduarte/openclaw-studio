import type { AgentState } from "@/features/agents/state/store";
import { buildAgentStudioSessionKey } from "@/lib/gateway/sessionKeys";

export const buildNewSessionAgentPatch = (
  agent: AgentState,
  sessionId: string
): Partial<AgentState> => {
  const trimmedSessionId = sessionId.trim();
  if (!trimmedSessionId) {
    throw new Error("Session id is required.");
  }
  return {
    sessionKey: buildAgentStudioSessionKey(agent.agentId, trimmedSessionId),
    status: "idle",
    runId: null,
    streamText: null,
    thinkingTrace: null,
    outputLines: [],
    lastResult: null,
    lastDiff: null,
    latestOverride: null,
    latestOverrideKind: null,
    lastAssistantMessageAt: null,
    lastActivityAt: null,
    latestPreview: null,
    lastUserMessage: null,
    draft: "",
    historyLoadedAt: null,
    awaitingUserInput: false,
    hasUnseenActivity: false,
    sessionCreated: false,
    sessionSettingsSynced: false,
  };
};
