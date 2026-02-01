import path from "node:path";

import { resolveStateDir } from "@/lib/clawdbot/paths";
import { deleteDirRecursiveIfExists } from "@/lib/fs.server";
import type { ProjectTile } from "@/lib/projects/types";

export const resolveAgentStateDir = (agentId: string) => {
  return path.join(resolveStateDir(), "agents", agentId);
};

export const deleteDirIfExists = (targetPath: string, label: string, warnings: string[]) => {
  const result = deleteDirRecursiveIfExists(targetPath);
  if (!result.deleted) {
    warnings.push(`${label} not found at ${targetPath}.`);
  }
};

export const deleteAgentArtifacts = (_projectId: string, agentId: string, warnings: string[]) => {
  const agentDir = resolveAgentStateDir(agentId);
  deleteDirIfExists(agentDir, "Agent state", warnings);
};

export const collectAgentIdsAndDeleteArtifacts = (
  projectId: string,
  tiles: ProjectTile[],
  warnings: string[]
): string[] => {
  const agentIds: string[] = [];
  for (const tile of tiles) {
    if (!tile.agentId?.trim()) {
      warnings.push(`Missing agentId for tile ${tile.id}; skipped agent cleanup.`);
      continue;
    }
    deleteAgentArtifacts(projectId, tile.agentId, warnings);
    agentIds.push(tile.agentId);
  }
  return agentIds;
};
