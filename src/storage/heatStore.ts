// src/storage/heatStore.ts — Heatmap state management

import { loadJSON, saveJSON } from "./jsonStore.js";
import { HEAT_STATE_FILE } from "../config/config.js";

/**
 * Load heatmap state from disk
 * @returns {Object} Heatmap state with points array, lastSentCount, messageId, and lastUpdate
 */
export function loadHeat() {
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
export function saveHeat(h) {
  saveJSON(HEAT_STATE_FILE, h);
}
