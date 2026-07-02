// src/storage/stateStore.js — Kill-feed state management

const { loadJSON, saveJSON } = require("./jsonStore");
const { STATE_FILE } = require("../config/config");

/**
 * Load kill-feed state from disk
 * @returns {Object} State object with file positions and carry buffers
 */
function loadState() {
  return loadJSON(STATE_FILE, {});
}

/**
 * Save kill-feed state to disk
 * @param {Object} s - State object to save
 */
function saveState(s) {
  saveJSON(STATE_FILE, s);
}

module.exports = {
  loadState,
  saveState,
};
