// src/storage/mockStatsStore.js — Mock player stats persistence

const { resolveProjectPath } = require("../config/projectPaths");
const { loadJSON, saveJSON } = require("./jsonStore");

const MOCK_STATS_FILE = resolveProjectPath("data", "mock-player-stats.json");

/**
 * Load mock player stats from JSON file
 * @returns {Object} - Player stats object (empty if file doesn't exist)
 */
function loadMockStats() {
  return loadJSON(MOCK_STATS_FILE, {});
}

/**
 * Save mock player stats to JSON file
 * @param {Object} stats - Player stats object to save
 */
function saveMockStats(stats) {
  saveJSON(MOCK_STATS_FILE, stats, 2);
}

module.exports = {
  loadMockStats,
  saveMockStats,
};
