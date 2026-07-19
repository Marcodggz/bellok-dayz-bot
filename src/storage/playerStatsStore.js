// src/storage/playerStatsStore.js — Real player statistics persistence

const path = require("path");
const { loadJSON, saveJSON } = require("./jsonStore");

const PLAYER_STATS_FILE = path.join(
  __dirname,
  "../../data/player-stats.json",
);

function loadPlayerStats() {
  return loadJSON(PLAYER_STATS_FILE, {});
}

function savePlayerStats(stats) {
  saveJSON(PLAYER_STATS_FILE, stats);
}

module.exports = {
  loadPlayerStats,
  savePlayerStats,
};
