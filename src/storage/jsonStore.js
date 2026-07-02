// src/storage/jsonStore.js — JSON file read/write utilities

const fs = require('fs');

/**
 * Load and parse JSON file, return fallback on error
 */
function loadJSON(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

/**
 * Save data to JSON file
 */
function saveJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data));
}

module.exports = {
  loadJSON,
  saveJSON,
};
