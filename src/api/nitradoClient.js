// src/api/nitradoClient.js — Nitrado API client
const axios = require("axios");
const config = require("../config/config");
const {
  bufToText,
  looksLikeHtml,
  looksLikeRateLimit,
} = require("../utils/helpers");

const { NIT_API, SERVICE_ID, NIT_TOKEN, ROTATE_CHECK_MS, LIST_COOLDOWN_MS } =
  config;

// ================== NITRADO API CLIENT ==================
const nit = axios.create({
  baseURL: NIT_API,
  headers: { Authorization: `Bearer ${NIT_TOKEN}` },
  timeout: 12000,
});

async function nitDownload(filePath) {
  try {
    const r1 = await nit.get(
      `/services/${SERVICE_ID}/gameservers/file_server/download`,
      {
        params: { file: filePath, _: Date.now() },
        responseType: "arraybuffer",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
        validateStatus: (s) => s >= 200 && s < 300,
      },
    );
    let buf = Buffer.from(r1.data);
    const txt = buf.toString("utf8").trim();

    if (txt.startsWith("{")) {
      const j = JSON.parse(txt);
      const rawUrl = j?.data?.token?.url || j?.token?.url;
      if (!rawUrl) return { error: true };
      const r2 = await axios.get(
        rawUrl + (rawUrl.includes("?") ? "&" : "?") + "_=" + Date.now(),
        {
          responseType: "arraybuffer",
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
          timeout: 12000,
          validateStatus: (s) => s >= 200 && s < 300,
        },
      );
      buf = Buffer.from(r2.data);
      const t2 = bufToText(buf).slice(0, 200);
      if (looksLikeHtml(t2)) return { error: true };
    } else if (looksLikeHtml(txt)) {
      return { error: true };
    }
    return { buffer: buf };
  } catch (e) {
    const status = e?.response?.status;
    const txt = bufToText(e?.response?.data);
    if (looksLikeHtml(txt)) console.warn("[download] Unexpected HTML response");
    else if (status === 429 || looksLikeRateLimit(txt))
      console.warn("[download] Nitrado rate limit");
    else
      console.warn(
        "[download] error:",
        status || "",
        (txt || e.message).slice(0, 200),
      );
    return { error: true };
  }
}

// ================== NITRADO ADM LIST (with backoff + cooldown + cache) ==================
let listCooldownUntil = 0;
const listCache = new Map();
let lastRotateCheck = 0;

function tsFromName(n) {
  const m = n.match(
    /(\d{4})[-_](\d{2})[-_](\d{2})[ _-](\d{2})[-_](\d{2})[-_](\d{2})/,
  );
  if (!m) return 0;
  const [Y, Mo, D, h, mi, s] = [+m[1], +m[2], +m[3], +m[4], +m[5], +m[6]];
  return Date.UTC(Y, Mo - 1, D, h, mi, s);
}

async function listAdmNames(dir, force = false) {
  const now = Date.now();
  if (!force) {
    if (now < listCooldownUntil) return listCache.get(dir) || [];
    if (now - lastRotateCheck < ROTATE_CHECK_MS)
      return listCache.get(dir) || [];
    lastRotateCheck = now;
  }

  for (let i = 0; i < 3; i++) {
    try {
      const r = await nit.get(
        `/services/${SERVICE_ID}/gameservers/file_server/list`,
        {
          params: { dir, _: Date.now() + i },
          responseType: "json",
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
          validateStatus: (s) => s >= 200 && s < 300,
        },
      );
      const entries = r.data?.data?.entries || [];
      const rows = entries
        .filter((e) => e.type === "file" && /\.adm$/i.test(e.name))
        .map((e) => ({
          name: e.name,
          path: e.path || `${dir.replace(/\/+$/, "")}/${e.name}`,
        }))
        .sort((a, b) => (tsFromName(b.name) || 0) - (tsFromName(a.name) || 0));
      listCache.set(dir, rows);
      return rows;
    } catch (e) {
      const status = e?.response?.status;
      const txt = bufToText(e?.response?.data);
      const html = looksLikeHtml(txt);
      const rl = status === 429 || looksLikeRateLimit(txt);
      if (html || rl) {
        if (i === 2) {
          listCooldownUntil = Date.now() + LIST_COOLDOWN_MS;
          console.warn(
            "[list] cooldown",
            Math.round(LIST_COOLDOWN_MS / 1000),
            "s",
          );
          return listCache.get(dir) || [];
        }
        const wait = 800 * Math.pow(2, i);
        if (config.DEBUG) console.log(`[list] backoff ${wait}ms`);
        await new Promise((r) => setTimeout(r, wait));
      } else {
        console.warn(
          "[list] error:",
          status || "",
          (txt || e.message).slice(0, 200),
        );
        return listCache.get(dir) || [];
      }
    }
  }
  return listCache.get(dir) || [];
}

function startListCooldown(durationMs) {
  const now = Date.now();
  const startedNewCooldown = now >= listCooldownUntil;
  listCooldownUntil = now + durationMs;
  return startedNewCooldown;
}

module.exports = {
  nitDownload,
  listAdmNames,
  tsFromName,
  startListCooldown,
};
