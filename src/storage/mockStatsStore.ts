// Mock player stats persistence

import { resolveProjectPath } from "../config/projectPaths";
import { loadJSON, saveJSON } from "./jsonStore";
import type { PersistedPlayerStatsCollection } from "../types/domainPersistence";

const MOCK_STATS_FILE = resolveProjectPath("data", "mock-player-stats.json");

export function loadMockStats(): PersistedPlayerStatsCollection {
  return loadJSON(MOCK_STATS_FILE, {}) as PersistedPlayerStatsCollection;
}

export function saveMockStats(stats: PersistedPlayerStatsCollection): void {
  saveJSON(MOCK_STATS_FILE, stats, 2);
}
