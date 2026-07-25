// src/storage/heatStore.ts — Heatmap state management

import { HEAT_STATE_FILE } from "../config/config.js";
import type { HeatState } from "../types/domainHeatmap.js";
import { loadJSON, saveJSON } from "./jsonStore.js";

/**
 * Load heatmap state from disk
 */
export function loadHeat(): HeatState {
  return loadJSON<HeatState>(HEAT_STATE_FILE, {
    points: [],
    lastSentCount: 0,
    messageId: null,
    lastUpdate: 0,
  });
}

/**
 * Save heatmap state to disk
 */
export function saveHeat(heatState: HeatState): void {
  saveJSON(HEAT_STATE_FILE, heatState);
}
