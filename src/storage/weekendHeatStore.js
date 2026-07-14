// src/storage/weekendHeatStore.js — Weekend Heatmap state management

const { loadJSON, saveJSON } = require("./jsonStore");
const { WEEKEND_HEATMAP_STATE_FILE } = require("../config/config");

function loadWeekendHeat() {
  return loadJSON(WEEKEND_HEATMAP_STATE_FILE, {
    points: [],
    messageId: null,
    lastUpdate: 0,
  });
}

function saveWeekendHeat(wh) {
  saveJSON(WEEKEND_HEATMAP_STATE_FILE, wh);
}

module.exports = {
  loadWeekendHeat,
  saveWeekendHeat,
};
