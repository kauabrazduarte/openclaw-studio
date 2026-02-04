import fs from "node:fs";
import path from "node:path";

import {
  readConfigAgentList,
  writeConfigAgentList,
  type ConfigAgentEntry,
} from "@/lib/agents/configList";
import { resolveConfigPathCandidates, resolveStateDir } from "@/lib/clawdbot/paths";

type ClawdbotConfig = Record<string, unknown>;

export type AgentEntry = ConfigAgentEntry & {
  name?: string;
  workspace?: string;
};

const CONFIG_FILENAME = "openclaw.json";

const parseJsonLoose = (raw: string) => {
  try {
    return JSON.parse(raw) as ClawdbotConfig;
  } catch {
    const cleaned = raw.replace(/,(\s*[}\]])/g, "$1");
    return JSON.parse(cleaned) as ClawdbotConfig;
  }
};

export const loadClawdbotConfig = (): { config: ClawdbotConfig; configPath: string } => {
  const candidates = resolveConfigPathCandidates();
  const fallbackPath = path.join(resolveStateDir(), CONFIG_FILENAME);
  const configPath = candidates.find((candidate) => fs.existsSync(candidate)) ?? fallbackPath;
  if (!fs.existsSync(configPath)) {
    throw new Error(`Missing config at ${configPath}.`);
  }
  const raw = fs.readFileSync(configPath, "utf8");
  return { config: parseJsonLoose(raw), configPath };
};

export const saveClawdbotConfig = (configPath: string, config: ClawdbotConfig) => {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");
};

export const readAgentList = (config: Record<string, unknown>): AgentEntry[] => {
  return readConfigAgentList(config);
};

export const writeAgentList = (config: Record<string, unknown>, list: AgentEntry[]) => {
  const next = writeConfigAgentList(config, list);
  config.agents = next.agents;
};
