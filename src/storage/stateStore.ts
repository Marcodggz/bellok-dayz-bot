// src/storage/stateStore.ts — Kill-feed state management

import { STATE_FILE } from "../config/config.js";
import type { KillfeedState } from "../types/domainPersistence.js";
import { loadJSON, saveJSON } from "./jsonStore.js";

/**
 * Load kill-feed state from disk
 */
export function loadState(): KillfeedState {
  return loadJSON<KillfeedState>(STATE_FILE, {});
}

/**
 * Save kill-feed state to disk
 */
export function saveState(state: KillfeedState): void {
  saveJSON(STATE_FILE, state);
}
