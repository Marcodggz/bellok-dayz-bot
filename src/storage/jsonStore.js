// src/storage/jsonStore.js — JSON file read/write utilities

const fs = require("fs");

/**
 * Load and parse JSON file, return fallback on error
 */
function loadJSON(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

/**
 * Save data to JSON file using an atomic temporary-file replacement
 */
function saveJSON(file, data, spacing) {
  const temporaryFile = `${file}.tmp`;
  const serializedData = JSON.stringify(data, null, spacing);

  try {
    fs.writeFileSync(temporaryFile, serializedData);
    fs.renameSync(temporaryFile, file);
  } catch (error) {
    try {
      fs.rmSync(temporaryFile, { force: true });
    } catch {
      // Preserve the original write or rename error.
    }

    throw error;
  }
}

module.exports = {
  loadJSON,
  saveJSON,
};
