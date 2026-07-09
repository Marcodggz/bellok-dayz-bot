// src/storage/heatStore.js — Heatmap state management

const { loadJSON, saveJSON } = require("./jsonStore");
const { HEAT_STATE_FILE } = require("../config/config");

/**
 * Load heatmap state from disk
 * @returns {Object} Heatmap state with points array, lastSentCount, messageId, and lastUpdate
 */
function loadHeat() {
  return loadJSON(HEAT_STATE_FILE, {
    points: [],
    lastSentCount: 0,
    messageId: null,
    lastUpdate: 0,
  });
}

/**
 * Save heatmap state to disk
 * @param {Object} h - Heatmap state object to save
 */
function saveHeat(h) {
  saveJSON(HEAT_STATE_FILE, h);
}

module.exports = {
  loadHeat,
  saveHeat,
};
