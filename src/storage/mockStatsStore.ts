// Mock player stats persistence

import { resolveProjectPath } from "../config/projectPaths.js";
import { loadJSON, saveJSON } from "./jsonStore.js";
import type { PersistedPlayerStatsCollection } from "../types/domainPersistence.js";

const MOCK_STATS_FILE = resolveProjectPath("data", "mock-player-stats.json");

export function loadMockStats(): PersistedPlayerStatsCollection {
  return loadJSON<PersistedPlayerStatsCollection>(MOCK_STATS_FILE, {});
}

export function saveMockStats(stats: PersistedPlayerStatsCollection): void {
  saveJSON(MOCK_STATS_FILE, stats, 2);
}
