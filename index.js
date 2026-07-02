// index.js — DayZ (Nitrado PS4) → Kill-feed + Heatmap (Discord, fondo Chernarus)
// - PvP rojo: "<killer>" killed "<victim>" with "<gun>"
// - Explosión naranja: "<player>" died from an "<explosive>" explosion
// - Heatmap: único mensaje "⚔️PVP heat-map 🥵"
// - Precisión de puntos: calibración por min/max/offset/escala/flip

const axios = require("axios");
const fs = require("fs");
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  AttachmentBuilder,
} = require("discord.js");
const { PNG } = require("pngjs");

// Import config and helpers
const config = require("./src/config/config");
const {
  bufToText,
  looksLikeHtml,
  looksLikeRateLimit,
  tMadrid,
  clamp,
  escapeRegExp,
} = require("./src/utils/helpers");
const { loadJSON, saveJSON } = require("./src/storage/jsonStore");
const { loadState, saveState } = require("./src/storage/stateStore");
const { loadHeat, saveHeat } = require("./src/storage/heatStore");

const MODE = process.argv[2] || "run";

// Destructure config for convenience
const {
  NIT_API,
  SERVICE_ID,
  NIT_TOKEN,
  ADM_DIR,
  CHANNEL_ID,
  HEATMAP_CHANNEL_ID,
  START_AT_END,
  RAW_TO_DISCORD,
  DEBUG,
  DEBUG_TICKS,
  POLL_MS,
  ROTATE_CHECK_MS,
  LIST_COOLDOWN_MS,
  HEATMAP_INTERVAL_MS,
  HEATMAP_WIDTH,
  HEATMAP_HEIGHT,
  MAP_SIZE,
  HEATMAP_WINDOW_MIN,
  HEATMAP_RESET_ON_ROTATE,
  CHERNARUS_MAP_PATH,
  MAP_MIN_X,
  MAP_MAX_X,
  MAP_MIN_Y,
  MAP_MAX_Y,
  MAP_FLIP_Y,
  MAP_OFFSET_X,
  MAP_OFFSET_Y,
  MAP_SCALE_X,
  MAP_SCALE_Y,
  HEAT_RADIUS,
  HEAT_GAMMA,
  HEAT_MIN_ALPHA,
  HEAT_HALFLIFE_MIN,
  HEAT_NORM_PERCENTILE,
  HEAT_RECENT_MIN,
  HEAT_RECENT_DOT_RADIUS,
  HEAT_RECENT_DOT_ALPHA,
  STATE_FILE,
  HEAT_STATE_FILE,
  HEAT_IMG_PATH,
} = config;

// ================== ESTADO KILL-FEED ==================
function getFileState(st, filePath) {
  return st[filePath] || { size: 0, carry: "" };
}
function setFileState(st, filePath, obj) {
  st[filePath] = obj;
  saveState(st);
}

// ================== ESTADO HEATMAP ==================
function addHeatPoint(x, y) {
  const h = loadHeat();
  const ts = Date.now();
  h.points.push({ x: clamp(x, 0, MAP_SIZE), y: clamp(y, 0, MAP_SIZE), ts });
  pruneHeat(h);
  saveHeat(h);
}
function pruneHeat(h) {
  const minTs = Date.now() - HEATMAP_WINDOW_MIN * 60 * 1000;
  h.points = h.points.filter((p) => p.ts >= minTs);
}

// ================== NITRADO API ==================
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
    if (looksLikeHtml(txt)) console.warn("[download] HTML intermedio.");
    else if (status === 429 || looksLikeRateLimit(txt))
      console.warn("[download] Rate-limit Nitrado.");
    else
      console.warn(
        "[download] error:",
        status || "",
        (txt || e.message).slice(0, 200),
      );
    return { error: true };
  }
}

// ===== list con backoff + cooldown + caché =====
let listCooldownUntil = 0;
const listCache = new Map(); // dir → [{name,path}]
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
        if (DEBUG) console.log(`[list] backoff ${wait}ms`);
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

// ================== ROTACIÓN ==================
let CURRENT_ADM = null;
let INITIALIZED = false;

async function ensureLatestAdmSelected() {
  if (!ADM_DIR) {
    console.warn("[rotate] Falta NITRADO_ADM_DIR");
    return;
  }
  const rows = await listAdmNames(ADM_DIR, !INITIALIZED /*force*/);
  if (!rows.length) {
    if (DEBUG) console.log("[rotate] sin rows en listado");
    return;
  }
  const latest = rows[0].path;
  if (latest !== CURRENT_ADM) {
    CURRENT_ADM = latest;
    console.log("[rotate] nuevo ADM →", CURRENT_ADM);
    const st = loadState();
    const dl = await nitDownload(CURRENT_ADM);
    const buf = dl.error ? Buffer.alloc(0) : dl.buffer;
    const startSize = INITIALIZED ? 0 : START_AT_END ? buf.length : 0;
    setFileState(st, CURRENT_ADM, { size: startSize, carry: "" });
    INITIALIZED = true;

    if (HEATMAP_RESET_ON_ROTATE) {
      const h = loadHeat();
      h.points = [];
      h.lastSentCount = 0;
      saveHeat(h);
    }
  }
}

// ================== TAIL ==================
async function readNewLines(filePath) {
  const st = loadState();
  const fsState = getFileState(st, filePath);

  const dl = await nitDownload(filePath);
  if (dl.error) return [];
  const buf = dl.buffer;

  if (buf.length <= fsState.size) return [];

  const rotated = buf.length < fsState.size;
  let from = rotated ? 0 : Math.min(fsState.size, buf.length);
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

// ================== PARSER / POSICIONES ==================
function shouldIgnore(line) {
  if (/##### PlayerList log/i.test(line)) return true;
  if (/ is connected| has been disconnected/i.test(line)) return true;
  if (/performed Emote(?!Suicide)/i.test(line)) return true;
  return false;
}
const TIME_RE = /^\s*(\d{2}:\d{2}:\d{2})\s*\|/;
const q = `["'“”]`;
const EXPLO = /explosion|grenade|mine|landmine|tripwire|ied/i;

// PvP: "killed Player ..." y "(DEAD) ... killed by Player ..."
const PVP_PATTERNS = [
  new RegExp(
    `Player ${q}(.+?)${q}[^|\\r\\n]*?killed Player ${q}(.+?)${q}[^|\\r\\n]*?(?: with ([^|\\r\\n]+?))?(?: from| at| \\(|$)`,
    "i",
  ),
  new RegExp(
    `Player ${q}(.+?)${q}[^|\\r\\n]*?(?:\\(DEAD\\)\\s*)?(?:was\\s+)?killed by Player ${q}(.+?)${q}[^|\\r\\n]*?(?: with ([^|\\r\\n]+?))?(?: from| at| \\(|$)`,
    "i",
  ),
];

function cleanWeapon(s) {
  if (!s) return null;
  return String(s)
    .replace(/\s+from.*$/i, "")
    .replace(/\s+at.*$/i, "")
    .replace(/\s*\(.*?\)\s*$/, "")
    .trim();
}
function cleanDevice(s) {
  if (!s) return null;
  return String(s)
    .replace(/^an?\s+/i, "")
    .replace(/\s+from.*$/i, "")
    .replace(/\s*\(.*?\)\s*$/, "")
    .trim();
}

function parseKill(line) {
  if (shouldIgnore(line)) return null;
  const tm = line.match(TIME_RE);
  const t = tm ? tm[1] : null;

  for (const re of PVP_PATTERNS) {
    const m = line.match(re);
    if (m) {
      let killer, victim, weapon;
      if (/killed Player/i.test(re.source)) {
        killer = m[1];
        victim = m[2];
        weapon = cleanWeapon(m[3]);
      } else {
        victim = m[1];
        killer = m[2];
        weapon = cleanWeapon(m[3]);
      }
      return { type: "pvp", killer, victim, weapon, t, line };
    }
  }
  {
    // Explosión: "Player "X" ... killed by <cause>" y cause coincide con EXPLO
    const m = line.match(
      new RegExp(`Player ${q}(.+?)${q}.*?killed by ([^|\\r\\n]+)`, "i"),
    );
    if (m) {
      const victim = m[1];
      const cause = m[2].trim();
      if (EXPLO.test(cause)) {
        const device = cleanDevice(cause);
        return { type: "explosion", victim, device, t, line };
      }
    }
  }
  return null;
}

// — rastrear posiciones por nombre (última conocida) —
const lastPosByName = new Map();
function updatePositionsFromLine(line) {
  const re =
    /Player\s+["'“”]([^"'“”]+)["'“”]\s*\([^)]*?pos=<\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.\-]+)\s*>\)/gi;
  let m;
  while ((m = re.exec(line)) !== null) {
    const name = m[1];
    const x = +m[2];
    const y = +m[3];
    if (!Number.isNaN(x) && !Number.isNaN(y))
      lastPosByName.set(name, { x, y, ts: Date.now() });
  }
}
function posForVictimFromLine(victim, line) {
  const rex = new RegExp(
    `Player\\s+["'“”]${escapeRegExp(victim)}["'“”][^\\n]*?pos=<\\s*([0-9.]+)\\s*,\\s*([0-9.]+)\\s*,\\s*([0-9.\\-]+)\\s*>`,
    "i",
  );
  const m = line.match(rex);
  if (m) {
    return { x: +m[1], y: +m[2] };
  }
  const last = lastPosByName.get(victim);
  return last ? { x: last.x, y: last.y } : null;
}

// ================== MAPEO COORDENADAS → PIXELES ==================
function mapToPixelCoords(x, y, W, H) {
  // --- 1) Normaliza (aplican recortes/offset/escala si usas MAP_MIN/MAX/OFFSET/SCALE) ---
  const nx = (x - MAP_MIN_X) / Math.max(1, MAP_MAX_X - MAP_MIN_X);
  const ny = (y - MAP_MIN_Y) / Math.max(1, MAP_MAX_Y - MAP_MIN_Y);
  const sx = nx * MAP_SCALE_X + MAP_OFFSET_X;
  const sy = ny * MAP_SCALE_Y + MAP_OFFSET_Y;

  // --- 2) Letterbox: usa SIEMPRE el cuadrado centrado de la imagen ---
  //     (en tu PNG 1500×1356 → side=1356, offX=72, offY=0)
  const side = Math.min(W, H);
  const offX = (W - side) / 2;
  const offY = (H - side) / 2;

  // --- 3) Insets en píxeles para recortar el marco interior del mapa ---
  const INSET_L = Number(process.env.MAP_PIX_INSET_L || 0);
  const INSET_R = Number(process.env.MAP_PIX_INSET_R || 0);
  const INSET_T = Number(process.env.MAP_PIX_INSET_T || 0);
  const INSET_B = Number(process.env.MAP_PIX_INSET_B || 0);

  const innerW = Math.max(1, side - INSET_L - INSET_R);
  const innerH = Math.max(1, side - INSET_T - INSET_B);

  // --- 4) Proyección u,v (0..1), flip vertical opcional ---
  const u = clamp(sx, 0, 1);
  const v = clamp(MAP_FLIP_Y ? 1 - sy : sy, 0, 1);

  // --- 5) A píxeles dentro del cuadrado centrado + insets ---
  const px = Math.floor(offX + INSET_L + u * innerW);
  const py = Math.floor(offY + INSET_T + v * innerH);
  return { px, py };
}

// ================== DEDUPE 20s ==================
function typeRank(tp) {
  return tp === "pvp" ? 2 : tp === "explosion" ? 1 : 0;
}
function timeToSec(t) {
  if (!t) return null;
  const [hh, mm, ss] = t.split(":").map(Number);
  if ([hh, mm, ss].some(Number.isNaN)) return null;
  return hh * 3600 + mm * 60 + ss;
}
const BUCKET_S = 20;
function victimBucketKey(victim, t) {
  const s = timeToSec(t);
  const b =
    s == null
      ? Math.floor(Date.now() / 1000 / BUCKET_S)
      : Math.floor(s / BUCKET_S);
  return `${victim}|${b}`;
}
const sentBuckets = new Map();
const SENT_TTL_MS = 60 * 60 * 1000;
function alreadySentBucket(key) {
  const now = Date.now();
  for (const [kk, ts] of sentBuckets)
    if (now - ts > SENT_TTL_MS) sentBuckets.delete(kk);
  if (sentBuckets.has(key)) return true;
  sentBuckets.set(key, now);
  return false;
}

// ================== EMBEDS ==================
function embedPvp({ killer, victim, weapon }) {
  const txt = weapon
    ? `"${killer}" killed "${victim}" with "${weapon}"`
    : `"${killer}" killed "${victim}"`;
  return {
    embeds: [
      new EmbedBuilder()
        .setColor(0xe11d48)
        .setDescription(txt)
        .setTimestamp(new Date()),
    ],
  };
}
function embedExplosion({ victim, device }) {
  const dev = device || "explosive";
  const txt = `"${victim}" died from an "${dev}" explosion`;
  return {
    embeds: [
      new EmbedBuilder()
        .setColor(0xf59e0b)
        .setDescription(txt)
        .setTimestamp(new Date()),
    ],
  };
}
function buildKillEmbed(k) {
  if (k.type === "pvp") return embedPvp(k);
  if (k.type === "explosion") return embedExplosion(k);
  return null;
}

// ================== HEATMAP RENDER (con calibración + mejoras) ==================
function renderHeatPng(points, outPath, baseMapPath = "") {
  let basePng = null;
  let W = HEATMAP_WIDTH,
    H = HEATMAP_HEIGHT;

  // 1) Cargar mapa base si existe
  try {
    if (baseMapPath && fs.existsSync(baseMapPath)) {
      const buf = fs.readFileSync(baseMapPath);
      basePng = PNG.sync.read(buf);
      W = basePng.width;
      H = basePng.height;
    }
  } catch (e) {
    console.warn(
      "[heatmap] no se pudo leer CHERNARUS_MAP_PATH, uso lienzo transparente:",
      e.message,
    );
  }

  // 2) Buffer de intensidad
  const inten = new Float32Array(W * H);

  // Radio del “pincel”
  const radius =
    HEAT_RADIUS > 0
      ? Math.floor(HEAT_RADIUS)
      : Math.max(10, Math.floor(Math.min(W, H) / 30));

  const sigma = radius / 2;
  const twoSigma2 = 2 * sigma * sigma;

  // Kernel gaussiano
  const ker = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const d2 = dx * dx + dy * dy;
      if (d2 <= radius * radius)
        ker.push({ dx, dy, w: Math.exp(-d2 / twoSigma2) });
    }
  }

  // 3) Proyectar puntos con peso temporal (recientes pesan más)
  const now = Date.now();
  const hp = loadHeat().points;
  for (const p of hp) {
    const ageMin = (now - p.ts) / 60000;
    const timeWeight =
      HEAT_HALFLIFE_MIN > 0 ? Math.pow(0.5, ageMin / HEAT_HALFLIFE_MIN) : 1;

    const { px, py } = mapToPixelCoords(p.x, p.y, W, H);
    for (const k of ker) {
      const x = px + k.dx,
        y = py + k.dy;
      if (x >= 0 && x < W && y >= 0 && y < H)
        inten[y * W + x] += k.w * timeWeight;
    }
  }

  // 4) Normalización por percentil (evita que un hotspot apague lo demás)
  let maxv = 0;
  for (let i = 0; i < inten.length; i++) if (inten[i] > maxv) maxv = inten[i];

  const overlay = new PNG({ width: W, height: H });

  if (maxv > 0) {
    let denom = maxv;
    if (HEAT_NORM_PERCENTILE > 0 && HEAT_NORM_PERCENTILE < 1) {
      const sampleStep = Math.max(1, Math.floor(inten.length / 100000));
      const vals = [];
      for (let i = 0; i < inten.length; i += sampleStep)
        if (inten[i] > 0) vals.push(inten[i]);
      if (vals.length) {
        vals.sort((a, b) => a - b);
        const idx = Math.max(
          0,
          Math.min(
            vals.length - 1,
            Math.floor(vals.length * HEAT_NORM_PERCENTILE) - 1,
          ),
        );
        denom = Math.max(vals[idx], maxv * 0.6);
      }
    }

    for (let i = 0; i < inten.length; i++) {
      let t = denom > 0 ? Math.min(1, inten[i] / denom) : 0;
      if (HEAT_GAMMA > 0 && HEAT_GAMMA !== 1) t = Math.pow(t, HEAT_GAMMA);

      // Paleta fire: naranja → rojo
      const r = t < 0.6 ? 245 : 225;
      const g = t < 0.6 ? 158 : 29;
      const b = t < 0.6 ? 11 : 72;

      const a = Math.round(
        clamp(HEAT_MIN_ALPHA + (255 - HEAT_MIN_ALPHA) * t, HEAT_MIN_ALPHA, 255),
      );

      const o = i * 4;
      overlay.data[o + 0] = r;
      overlay.data[o + 1] = g;
      overlay.data[o + 2] = b;
      overlay.data[o + 3] = a;
    }
  } else {
    overlay.data.fill(0);
  }

  // 5) Puntos ROJOS para muertes recientes (siempre visibles)
  if (HEAT_RECENT_MIN > 0) {
    const R =
      HEAT_RECENT_DOT_RADIUS > 0
        ? HEAT_RECENT_DOT_RADIUS
        : Math.max(4, Math.floor(Math.min(W, H) / 180));
    const A = clamp(HEAT_RECENT_DOT_ALPHA, 0, 255);
    const rr = R * R;
    const red = 225,
      green = 29,
      blue = 72; // #E11D48

    for (const p of hp) {
      if (now - p.ts > HEAT_RECENT_MIN * 60 * 1000) continue;
      const { px, py } = mapToPixelCoords(p.x, p.y, W, H);

      for (let dy = -R; dy <= R; dy++) {
        for (let dx = -R; dx <= R; dx++) {
          if (dx * dx + dy * dy > rr) continue;
          const x = px + dx,
            y = py + dy;
          if (x < 0 || x >= W || y < 0 || y >= H) continue;
          const o = (y * W + x) * 4;

          if (overlay.data[o + 3] < A) {
            overlay.data[o + 0] = red;
            overlay.data[o + 1] = green;
            overlay.data[o + 2] = blue;
            overlay.data[o + 3] = A;
          }
        }
      }
    }
  }

  // 6) Componer sobre el mapa base
  let outPng;
  if (basePng) {
    outPng = new PNG({ width: W, height: H });
    for (let i = 0; i < W * H; i++) {
      const o = i * 4;
      const br = basePng.data[o + 0],
        bg = basePng.data[o + 1],
        bb = basePng.data[o + 2],
        ba = basePng.data[o + 3] / 255;
      const or = overlay.data[o + 0],
        og = overlay.data[o + 1],
        ob = overlay.data[o + 2],
        oa = overlay.data[o + 3] / 255;

      const aOut = Math.min(1, oa + ba * (1 - oa));
      const rOut = Math.round((or * oa + br * ba * (1 - oa)) / (aOut || 1));
      const gOut = Math.round((og * oa + bg * ba * (1 - oa)) / (aOut || 1));
      const bOut = Math.round((ob * oa + bb * ba * (1 - oa)) / (aOut || 1));

      outPng.data[o + 0] = rOut;
      outPng.data[o + 1] = gOut;
      outPng.data[o + 2] = bOut;
      outPng.data[o + 3] = Math.round(aOut * 255);
    }
  } else {
    outPng = overlay;
  }

  fs.writeFileSync(outPath, PNG.sync.write(outPng));
}

// ================== DISCORD / BOOT ==================
function checkEnv() {
  console.log(
    "[boot] .env",
    "DISCORD_TOKEN=",
    !!config.DISCORD_TOKEN,
    "NITRADO_TOKEN=",
    !!NIT_TOKEN,
    "SERVICE_ID=",
    !!SERVICE_ID,
    "CHANNEL_ID=",
    !!CHANNEL_ID,
    "ADM_DIR=",
    !!ADM_DIR,
    "HEATMAP_CHANNEL_ID=",
    !!HEATMAP_CHANNEL_ID,
  );
  if (!NIT_TOKEN || !SERVICE_ID || !CHANNEL_ID || !config.DISCORD_TOKEN) {
    console.error(
      "Faltan .env: NITRADO_TOKEN, NITRADO_SERVICE_ID, DISCORD_CHANNEL_ID, DISCORD_TOKEN",
    );
    process.exit(1);
  }
  if (!ADM_DIR && MODE === "run") {
    console.error("Falta NITRADO_ADM_DIR (apunta a /noftp/.../dayzps/config)");
    process.exit(1);
  }
}

// ================== LOOP PRINCIPAL ==================
let heatmapSending = false;
let lastHeatSentAt = 0;

async function maybeSendHeatmap(client) {
  if (!HEATMAP_CHANNEL_ID) return;
  const now = Date.now();
  if (now - lastHeatSentAt < HEATMAP_INTERVAL_MS) return;

  const h = loadHeat();
  pruneHeat(h);
  if (!h.points.length) return;

  if (heatmapSending) return;
  heatmapSending = true;

  try {
    renderHeatPng(h.points, HEAT_IMG_PATH, CHERNARUS_MAP_PATH);
    await new Promise((r) => setTimeout(r, 80));
    const ch = await client.channels
      .fetch(HEATMAP_CHANNEL_ID)
      .catch(() => null);
    if (!ch || typeof ch.send !== "function") {
      console.warn("[heatmap] canal inválido");
      return;
    }
    const file = new AttachmentBuilder(HEAT_IMG_PATH);
    await ch.send({ content: "⚔️PVP heat-map 🥵", files: [file] }); // único mensaje
    h.lastSentCount = h.points.length;
    saveHeat(h);
    lastHeatSentAt = now;
  } catch (e) {
    console.warn("[heatmap] send error:", e?.code || e?.message || e);
  } finally {
    heatmapSending = false;
  }
}

async function runBot() {
  checkEnv();
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  let readyOnce = false;

  async function tick() {
    try {
      await ensureLatestAdmSelected();
      if (!CURRENT_ADM) {
        if (DEBUG_TICKS) console.log("[tick] sin CURRENT_ADM");
        return;
      }

      const lines = await readNewLines(CURRENT_ADM);
      if (DEBUG_TICKS)
        console.log(
          `[tick] ${new Date().toLocaleTimeString()}  +${lines.length} líneas nuevas`,
        );
      if (!lines.length) {
        await maybeSendHeatmap(client);
        return;
      }

      for (const ln of lines) updatePositionsFromLine(ln);

      const events = [];
      for (const ln of lines) {
        const e = parseKill(ln);
        if (e) events.push(e);
      }

      // agrupar por víctima/ventana de 20s y priorizar pvp>explosion
      const groups = new Map();
      for (const k of events) {
        const key = victimBucketKey(k.victim, k.t);
        const cur = groups.get(key);
        if (!cur || typeRank(k.type) > typeRank(cur.type)) groups.set(key, k);
      }

      const ch = await client.channels.fetch(CHANNEL_ID).catch(() => null);
      if (!ch || typeof ch.send !== "function") {
        console.warn("[tick] Missing Access / canal no válido.");
        return;
      }

      for (const [key, k] of groups) {
        if (alreadySentBucket(key)) continue;
        const payload = buildKillEmbed(k);
        if (!payload) continue;
        try {
          await ch.send(payload);
          if (RAW_TO_DISCORD) {
            const raw = lines.find(
              (l) =>
                l.includes(`"${k.victim}"`) && (k.t ? l.startsWith(k.t) : true),
            );
            if (raw) await ch.send("```" + raw + "```");
          }
        } catch (e) {
          console.error("[send error]", e?.code || e?.message || e);
        }

        // sumar punto al heatmap con la última posición conocida de la víctima
        const pos = posForVictimFromLine(k.victim, k.line || "");
        if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y))
          addHeatPoint(pos.x, pos.y);
      }

      await maybeSendHeatmap(client);
    } catch (e) {
      const status = e?.response?.status;
      const txt = bufToText(e?.response?.data);
      if (looksLikeHtml(txt) || status === 429 || looksLikeRateLimit(txt)) {
        if (Date.now() >= listCooldownUntil)
          console.warn("[tick] Nitrado ocupado; cooldown.");
        listCooldownUntil = Date.now() + LIST_COOLDOWN_MS;
      } else {
        console.warn(
          "[tick] error:",
          status || "",
          (txt || e.message).slice(0, 200),
        );
      }
    }
  }

  client.once("ready", async () => {
    if (readyOnce) return;
    readyOnce = true;
    console.log(`✅ Bot online como ${client.user.tag}`);
    await ensureLatestAdmSelected();
    setInterval(tick, POLL_MS);
  });

  client.login(config.DISCORD_TOKEN).catch((e) => {
    console.error("[login error]", e?.message || e);
    process.exit(1);
  });
}

// ================== UTILIDADES CLI ==================
async function runDiscordTest() {
  checkEnv();
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  client.once("ready", async () => {
    try {
      const ch = await client.channels.fetch(CHANNEL_ID);
      await ch.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0x22c55e)
            .setDescription("✅ Prueba: el bot puede enviar mensajes aquí.")
            .setTimestamp(new Date()),
        ],
      });
      console.log("[discord-test] enviado OK al canal de kill-feed");
    } catch (e) {
      console.error("[discord-test] ERROR:", e?.code || e?.message || e);
    } finally {
      process.exit(0);
    }
  });
  client.login(config.DISCORD_TOKEN).catch((e) => {
    console.error("[login error]", e?.message || e);
    process.exit(1);
  });
}

async function runDiscordHeatmapTest() {
  checkEnv();
  if (!HEATMAP_CHANNEL_ID) {
    console.error("Falta HEATMAP_CHANNEL_ID en .env");
    process.exit(1);
  }
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  client.once("ready", async () => {
    try {
      const ch = await client.channels.fetch(HEATMAP_CHANNEL_ID);
      await ch.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0x3b82f6)
            .setDescription("🧪 Prueba: canal de heat-map OK")
            .setTimestamp(new Date()),
        ],
      });
      console.log("[discord-heatmap-test] enviado OK al canal de heat-map");
    } catch (e) {
      console.error(
        "[discord-heatmap-test] ERROR:",
        e?.code || e?.message || e,
      );
    } finally {
      process.exit(0);
    }
  });
  client.login(config.DISCORD_TOKEN).catch((e) => {
    console.error("[login error]", e?.message || e);
    process.exit(1);
  });
}

async function runDiagnose() {
  checkEnv();
  console.log("\n[diagnose] Directorio .ADM:", ADM_DIR);
  const rows = await listAdmNames(ADM_DIR, true); // force
  if (!rows.length) {
    console.log(
      "[diagnose] ❌ No se listan .ADM (rate-limit o ruta incorrecta).",
    );
    process.exit(1);
  }
  console.log("[diagnose] Top 5 archivos:");
  for (const r of rows.slice(0, 5)) {
    const ts = tsFromName(r.name);
    console.log("  -", r.name, "→", ts ? tMadrid(ts) : "(sin fecha)");
  }
  const latest = rows[0].path;
  console.log("[diagnose] Último ADM:", latest);
  const dl = await nitDownload(latest);
  if (dl.error) {
    console.log("[diagnose] ❌ No se pudo descargar el ADM");
    process.exit(1);
  }
  const lines = dl.buffer.toString("utf8").split(/\r?\n/).filter(Boolean);
  const tail = lines.slice(-40);
  console.log("\n[diagnose] Últimas 40 líneas:\n" + tail.join("\n"));

  let pvp = 0,
    exp = 0;
  for (const ln of tail) {
    const e = parseKill(ln);
    if (e) {
      if (e.type === "pvp") pvp++;
      else if (e.type === "explosion") exp++;
    }
  }
  console.log(
    `\n[diagnose] Detectado en tail → PvP: ${pvp}  Explosiones: ${exp}`,
  );
  process.exit(0);
}

// ================== MAIN ==================
if (MODE === "discord-test") {
  runDiscordTest();
} else if (MODE === "discord-heatmap-test") {
  runDiscordHeatmapTest();
} else if (MODE === "diagnose") {
  runDiagnose();
} else {
  runBot();
}
