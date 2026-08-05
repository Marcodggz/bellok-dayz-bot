import { STATE_FILE } from "../config/config.js";
import type { KillfeedState } from "../types/domainPersistence.js";
import { loadJSON, saveJSON } from "./jsonStore.js";

export function loadState(): KillfeedState {
  return loadJSON<KillfeedState>(STATE_FILE, {});
}

export function saveState(state: KillfeedState): void {
  saveJSON(STATE_FILE, state);
}
