import fs from "node:fs";

export function loadJSON<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

// Write to a temporary file first to avoid leaving partially written JSON after a failure.
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
