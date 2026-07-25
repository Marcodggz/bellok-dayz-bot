// src/storage/fileStateStore.ts — File state tracking for tail operations

import type { FileTailState, KillfeedState } from "../types/domainPersistence.js";
import { saveState } from "./stateStore.js";

/**
 * Get the state for a specific file from the global state object
 */
export function getFileState(state: KillfeedState, filePath: string): FileTailState {
  const fileState = state[filePath];

  if (
    fileState &&
    "size" in fileState &&
    typeof fileState.size === "number" &&
    "carry" in fileState &&
    typeof fileState.carry === "string"
  ) {
    return {
      size: fileState.size,
      carry: fileState.carry,
    };
  }

  return { size: 0, carry: "" };
}

/**
 * Set the state for a specific file and persist to disk
 */
export function setFileState(
  state: KillfeedState,
  filePath: string,
  fileState: FileTailState
): void {
  state[filePath] = fileState;
  saveState(state);
}
