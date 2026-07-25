// src/storage/jsonStore.ts — JSON file read/write utilities

import fs from "node:fs";

/**
 * Load and parse JSON file, return fallback on error
 */
export function loadJSON<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

/**
 * Save data to JSON file using an atomic temporary-file replacement
 */
export function saveJSON(file: string, data: unknown, spacing?: number): void {
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
