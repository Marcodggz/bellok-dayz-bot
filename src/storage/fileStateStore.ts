import type { FileTailState, KillfeedState } from "../types/domainPersistence.js";
import { saveState } from "./stateStore.js";

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

export function setFileState(
  state: KillfeedState,
  filePath: string,
  fileState: FileTailState
): void {
  state[filePath] = fileState;
  saveState(state);
}
