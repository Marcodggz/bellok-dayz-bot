// src/storage/fileStateStore.js — File state tracking for tail operations

const { saveState } = require("./stateStore");

/**
 * Get the state for a specific file from the global state object
 * @param {Object} st - The global state object
 * @param {string} filePath - The file path to get state for
 * @returns {Object} File state with size and carry buffer
 */
function getFileState(st, filePath) {
  return st[filePath] || { size: 0, carry: "" };
}

/**
 * Set the state for a specific file and persist to disk
 * @param {Object} st - The global state object
 * @param {string} filePath - The file path to set state for
 * @param {Object} obj - The file state object (size, carry)
 */
function setFileState(st, filePath, obj) {
  st[filePath] = obj;
  saveState(st);
}

module.exports = {
  getFileState,
  setFileState,
};
