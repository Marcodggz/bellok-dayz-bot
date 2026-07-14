// src/storage/weekendHeatStore.js — Weekend Heatmap state management

const { loadJSON, saveJSON } = require("./jsonStore");
const { WEEKEND_HEATMAP_STATE_FILE } = require("../config/config");

/**
 * Load weekend heatmap state from disk
 * @returns {Object} Weekend heatmap state with points array, messageId, and lastUpdate
 */
function loadWeekendHeat() {
  return loadJSON(WEEKEND_HEATMAP_STATE_FILE, {
    points: [],
    messageId: null,
    lastUpdate: 0,
  });
}

/**
 * Save weekend heatmap state to disk
 * @param {Object} wh - Weekend heatmap state object to save
 */
function saveWeekendHeat(wh) {
  saveJSON(WEEKEND_HEATMAP_STATE_FILE, wh);
}

module.exports = {
  loadWeekendHeat,
  saveWeekendHeat,
};
