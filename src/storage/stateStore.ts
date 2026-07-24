// src/storage/stateStore.ts — Kill-feed state management

import { loadJSON, saveJSON } from "./jsonStore.js";
import { STATE_FILE } from "../config/config.js";

/**
 * Load kill-feed state from disk
 * @returns {Object} State object with file positions and carry buffers
 */
export function loadState() {
  return loadJSON(STATE_FILE, {});
}

/**
 * Save kill-feed state to disk
 * @param {Object} s - State object to save
 */
export function saveState(s) {
  saveJSON(STATE_FILE, s);
}
