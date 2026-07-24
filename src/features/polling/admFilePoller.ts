// admFilePoller.js — ADM file rotation detection and tail-reading

import * as config from "../../config/config.js";
import { loadState } from "../../storage/stateStore.js";
import { getFileState, setFileState } from "../../storage/fileStateStore.js";
import { loadHeat, saveHeat } from "../../storage/heatStore.js";
import { listAdmNames, nitDownload } from "../../api/nitradoClient.js";

const { ADM_DIR, START_AT_END, DEBUG, HEATMAP_RESET_ON_ROTATE } = config;

let _currentAdm = null;
let _initialized = false;

async function ensureLatestAdmSelected() {
  if (!ADM_DIR) {
    console.warn("[rotate] Missing NITRADO_ADM_DIR");
    return null;
  }
  const rows = await listAdmNames(ADM_DIR, !_initialized /*force*/);
  if (!rows.length) {
    if (DEBUG) console.log("[rotate] No ADM files found");
    return _currentAdm;
  }
  const latest = rows[0].path;
  if (latest !== _currentAdm) {
    _currentAdm = latest;
    console.log("[rotate] New ADM file →", _currentAdm);
    const st = loadState();
    const dl = await nitDownload(_currentAdm);
    const buf = dl.error ? Buffer.alloc(0) : dl.buffer;
    const startSize = _initialized ? 0 : START_AT_END ? buf.length : 0;
    setFileState(st, _currentAdm, { size: startSize, carry: "" });
    _initialized = true;

    if (HEATMAP_RESET_ON_ROTATE) {
      const h = loadHeat();
      h.points = [];
      h.lastSentCount = 0;
      saveHeat(h);
    }
  }
  return _currentAdm;
}

async function readNewLines(filePath) {
  const st = loadState();
  const fsState = getFileState(st, filePath);

  const dl = await nitDownload(filePath);
  if (dl.error) return [];
  const buf = dl.buffer;

  if (buf.length === fsState.size) return [];

  const rotated = buf.length < fsState.size;
  const from = rotated ? 0 : Math.min(fsState.size, buf.length);
  let chunk = buf.slice(from).toString("utf8");

  if (fsState.carry) {
    chunk = fsState.carry + chunk;
    fsState.carry = "";
  }

  if (chunk && !/\r?\n$/.test(chunk)) {
    const lastNL = chunk.lastIndexOf("\n");
    if (lastNL === -1) {
      fsState.carry = chunk;
      chunk = "";
    } else {
      fsState.carry = chunk.slice(lastNL + 1);
      chunk = chunk.slice(0, lastNL + 1);
    }
  }

  fsState.size = buf.length;
  setFileState(st, filePath, fsState);

  return chunk ? chunk.split(/\r?\n/).filter(Boolean) : [];
}

export { ensureLatestAdmSelected, readNewLines };
