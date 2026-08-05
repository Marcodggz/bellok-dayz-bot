import { HEAT_STATE_FILE } from "../config/config.js";
import type { HeatState } from "../types/domainHeatmap.js";
import { loadJSON, saveJSON } from "./jsonStore.js";

export function loadHeat(): HeatState {
  return loadJSON<HeatState>(HEAT_STATE_FILE, {
    points: [],
    lastSentCount: 0,
    messageId: null,
    lastUpdate: 0,
  });
}

export function saveHeat(heatState: HeatState): void {
  saveJSON(HEAT_STATE_FILE, heatState);
}
