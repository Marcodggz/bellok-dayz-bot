// src/storage/fileStateStore.ts — File state tracking for tail operations

import { saveState } from "./stateStore.js";

/**
 * Get the state for a specific file from the global state object
 * @param {Object} st - The global state object
 * @param {string} filePath - The file path to get state for
 * @returns {Object} File state with size and carry buffer
 */
export function getFileState(st, filePath) {
  return st[filePath] || { size: 0, carry: "" };
}

/**
 * Set the state for a specific file and persist to disk
 * @param {Object} st - The global state object
 * @param {string} filePath - The file path to set state for
 * @param {Object} obj - The file state object (size, carry)
 */
export function setFileState(st, filePath, obj) {
  st[filePath] = obj;
  saveState(st);
}
