// Resolve project resources consistently from source and compiled code

import fs from "node:fs";
import path from "node:path";

export function findProjectRoot(startDirectory: string = __dirname): string {
  let currentDirectory = path.resolve(startDirectory);

  while (true) {
    if (fs.existsSync(path.join(currentDirectory, "package.json"))) {
      return currentDirectory;
    }

    const parentDirectory = path.dirname(currentDirectory);

    if (parentDirectory === currentDirectory) {
      throw new Error(`Could not find project root from: ${startDirectory}`);
    }

    currentDirectory = parentDirectory;
  }
}

export const PROJECT_ROOT = findProjectRoot();

export function resolveProjectPath(...segments: string[]): string {
  return path.join(PROJECT_ROOT, ...segments);
}
