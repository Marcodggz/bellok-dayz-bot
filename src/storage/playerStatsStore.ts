// Real player statistics persistence

import { resolveProjectPath } from "../config/projectPaths";
import { loadJSON, saveJSON } from "./jsonStore.js";
import type {
  PersistedPlayerStatsCollection,
  PlayerStatsSearchResult,
} from "../types/domainPersistence";

const PLAYER_STATS_FILE = resolveProjectPath("data", "player-stats.json");

export function loadPlayerStats(): PersistedPlayerStatsCollection {
  return loadJSON(PLAYER_STATS_FILE, {}) as PersistedPlayerStatsCollection;
}

export function savePlayerStats(stats: PersistedPlayerStatsCollection): void {
  saveJSON(PLAYER_STATS_FILE, stats);
}

export function findPlayerStats(
  allStats: PersistedPlayerStatsCollection,
  gamertag: string
): PlayerStatsSearchResult | null {
  const trimmedGamertag = gamertag.trim();

  if (!trimmedGamertag) {
    return null;
  }

  if (Object.prototype.hasOwnProperty.call(allStats, trimmedGamertag)) {
    return {
      gamertag: trimmedGamertag,
      stats: allStats[trimmedGamertag],
    };
  }

  const lowercaseSearch = trimmedGamertag.toLowerCase();
  const matches = Object.entries(allStats).filter(
    ([storedGamertag]) => storedGamertag.toLowerCase() === lowercaseSearch
  );

  if (matches.length !== 1) {
    return null;
  }

  const [storedGamertag, stats] = matches[0];

  return {
    gamertag: storedGamertag,
    stats,
  };
}
