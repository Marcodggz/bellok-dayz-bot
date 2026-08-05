import { WEEKEND_HEATMAP_STATE_FILE } from "../config/config.js";
import type { WeekendHeatState } from "../types/domainHeatmap.js";
import { loadJSON, saveJSON } from "./jsonStore.js";

export function loadWeekendHeat(): WeekendHeatState {
  return loadJSON<WeekendHeatState>(WEEKEND_HEATMAP_STATE_FILE, {
    points: [],
    messageId: null,
    lastUpdate: 0,
  });
}

export function saveWeekendHeat(weekendHeatState: WeekendHeatState): void {
  saveJSON(WEEKEND_HEATMAP_STATE_FILE, weekendHeatState);
}
