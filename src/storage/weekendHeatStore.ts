// src/storage/weekendHeatStore.ts — Weekend Heatmap state management

import { loadJSON, saveJSON } from "./jsonStore.js";
import { WEEKEND_HEATMAP_STATE_FILE } from "../config/config.js";

export function loadWeekendHeat() {
  return loadJSON(WEEKEND_HEATMAP_STATE_FILE, {
    points: [],
    messageId: null,
    lastUpdate: 0,
  });
}

export function saveWeekendHeat(wh) {
  saveJSON(WEEKEND_HEATMAP_STATE_FILE, wh);
}
