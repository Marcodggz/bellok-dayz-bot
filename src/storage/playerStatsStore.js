// src/storage/playerStatsStore.js — Real player statistics persistence

const { resolveProjectPath } = require("../config/projectPaths");
const { loadJSON, saveJSON } = require("./jsonStore");

const PLAYER_STATS_FILE = resolveProjectPath("data", "player-stats.json");

function loadPlayerStats() {
  return loadJSON(PLAYER_STATS_FILE, {});
}

function savePlayerStats(stats) {
  saveJSON(PLAYER_STATS_FILE, stats);
}

/**
 * Find player stats by gamertag.
 * Tries an exact match first, then a unique case-insensitive match.
 * @param {Object} allStats - Map of gamertag to player stats
 * @param {string} gamertag - Gamertag to search for
 * @returns {{gamertag: string, stats: Object}|null}
 */
function findPlayerStats(allStats, gamertag) {
  const trimmedGamertag = String(gamertag || "").trim();

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

module.exports = {
  loadPlayerStats,
  savePlayerStats,
  findPlayerStats,
};
