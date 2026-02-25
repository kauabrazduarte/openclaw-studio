import { describe, expect, it, vi } from "vitest";

import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import { loadAgentSkillStatus } from "@/lib/skills/types";

describe("skills gateway client", () => {
  it("loads skills status for the selected agent", async () => {
    const report = {
      workspaceDir: "/tmp/workspace",
      managedSkillsDir: "/tmp/skills",
      skills: [],
    };
    const client = {
      call: vi.fn(async () => report),
    } as unknown as GatewayClient;

    const result = await loadAgentSkillStatus(client, " agent-1 ");

    expect(client.call).toHaveBeenCalledWith("skills.status", { agentId: "agent-1" });
    expect(result).toBe(report);
  });

  it("fails fast when agent id is empty", async () => {
    const client = {
      call: vi.fn(),
    } as unknown as GatewayClient;

    await expect(loadAgentSkillStatus(client, "  ")).rejects.toThrow(
      "Agent id is required to load skill status."
    );
    expect(client.call).not.toHaveBeenCalled();
  });
});
