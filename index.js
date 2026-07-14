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
const { getFileState, setFileState } = require("./src/storage/fileStateStore");
const {
  loadMockStats,
  saveMockStats,
} = require("./src/storage/mockStatsStore");
const { parseKill } = require("./src/parsers/killParser");
const {
  formatKillfeedNotification,
} = require("./src/features/killfeed/formatKillfeedNotification");
const {
  createEmptyStats,
  updateStatsFromEvent,
  getPlayerStats,
  handlePlayerConnect,
  handlePlayerDisconnect,
} = require("./src/features/stats/playerStats");
const {
  handleCommandInteraction,
} = require("./src/features/commands/commandHandler");
const {
  registerCommands,
} = require("./src/features/commands/registerCommands");
const {
  addWeekendHeatPoint,
  maybeSendWeekendHeatmap,
} = require("./src/utils/weekendHeatmapHelpers");

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

// ================== KILLFEED QUEUE ==================
const KILLFEED_FLUSH_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const killfeedQueue = []; // { event, timestamp, key }

/**
 * Add a killfeed event to the queue for batched delivery
 * @param {Object} event - The parsed kill event
 * @param {string} key - The deduplication bucket key
 */
function queueKillfeedEvent(event, key) {
  killfeedQueue.push({
    event,
    timestamp: Date.now(),
    key,
  });
}

/**
 * Flush the killfeed queue to Discord
 * Sends all queued events in order and removes them only after successful send
 * @param {Client} client - Discord client
 */
async function flushKillfeedQueue(client) {
  if (killfeedQueue.length === 0) {
    if (DEBUG) console.log("[killfeed] Queue empty, nothing to flush");
    return;
  }

  console.log(`[killfeed] Flushing ${killfeedQueue.length} queued events...`);

  try {
    const ch = await client.channels.fetch(CHANNEL_ID).catch(() => null);
    if (!ch || typeof ch.send !== "function") {
      console.warn("[killfeed] Missing Access / canal no válido.");
      return;
    }

    let sentCount = 0;

    // Process events from the queue one at a time
    // Remove from queue only after successful send
    while (killfeedQueue.length > 0) {
      const queuedEvent = killfeedQueue[0]; // Peek at first event
      const { event, timestamp, key } = queuedEvent;

      // Parse the time from the event (HH:MM:SS format) and combine with today's date
      let eventTimestamp = timestamp; // Default to queue timestamp
      if (event.kill.t) {
        const timeMatch = event.kill.t.match(/^(\d{2}):(\d{2}):(\d{2})$/);
        if (timeMatch) {
          const now = new Date(timestamp);
          const [, hours, minutes, seconds] = timeMatch;
          const eventDate = new Date(now);
          eventDate.setHours(parseInt(hours, 10));
          eventDate.setMinutes(parseInt(minutes, 10));
          eventDate.setSeconds(parseInt(seconds, 10));

          // Handle midnight rollover: if eventDate is more than 5 minutes in the future,
          // the event likely happened before midnight (yesterday)
          if (eventDate.getTime() - timestamp > 5 * 60 * 1000) {
            eventDate.setDate(eventDate.getDate() - 1);
          }

          eventTimestamp = eventDate.getTime();
        }
      }

      const payload = buildKillEmbed(event.kill, eventTimestamp);
      if (!payload) {
        // Skip invalid events and remove from queue
        killfeedQueue.shift();
        continue;
      }

      try {
        await ch.send(payload);
        if (RAW_TO_DISCORD && event.line) {
          const raw = event.line;
          if (raw) await ch.send("```" + raw + "```");
        }

        // Only remove from queue after successful send
        killfeedQueue.shift();
        sentCount++;

        // Small delay to avoid rate limiting
        await new Promise((r) => setTimeout(r, 100));
      } catch (e) {
        console.error(
          "[killfeed] send error, stopping flush. Remaining events will retry next time:",
          e?.code || e?.message || e,
        );
        // Stop flushing, leave failed event and remaining events in queue
        break;
      }
    }

    console.log(`[killfeed] Successfully flushed ${sentCount} events`);
  } catch (e) {
    console.error("[killfeed] flush error:", e?.code || e?.message || e);
  }
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
      // Keep messageId so we continue editing the same message after reset
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

// ================== POSICIONES ==================
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
    if (!Number.isNaN(x) && !Number.isNaN(y)) {
      lastPosByName.set(name, { x, y, ts: Date.now() });
      // Add to weekend heatmap if valid
      addWeekendHeatPoint(name, x, y);
    }
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

/**
 * Build iZurvive map URL for given coordinates
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} zoom - Zoom level (default 8)
 * @returns {string} iZurvive URL
 */
function buildIzurviveLocationUrl(x, y, zoom = 8) {
  return `https://www.izurvive.com/chernarusplus#location=${x};${y};${zoom}`;
}

/**
 * Get a random PvP action verb deterministically based on killer and victim names
 * @param {string} killer - Killer name
 * @param {string} victim - Victim name
 * @returns {string} Random action verb
 */
function getRandomPvpAction(killer, victim) {
  const actions = ["embarrassed", "eliminated", "shit on"];

  // Simple hash based on killer + victim for deterministic selection
  const seed = (killer || "").length + (victim || "").length * 3;
  const index = seed % actions.length;

  return actions[index];
}

function embedPvp(
  {
    killer,
    victim,
    weapon,
    distanceMeters,
    ammo,
    hitZone,
    damage,
    victimPosition,
    t,
  },
  eventTimestamp = null,
  killerStats = null,
  victimStats = null,
) {
  const lines = [];

  // Title
  lines.push(`**⚔️ Killfeed Notification ⚔️**`);

  // Format time for display (use parsed event time if available)
  let timeDisplay = "N/A";
  if (t) {
    // Convert HH:MM:SS to 12-hour format with a.m./p.m.
    const match = t.match(/^(\d{2}):(\d{2}):(\d{2})$/);
    if (match) {
      let hours = parseInt(match[1], 10);
      const minutes = match[2];
      const seconds = match[3];
      const period = hours >= 12 ? "p.m." : "a.m.";
      hours = hours % 12 || 12; // Convert to 12-hour format
      timeDisplay = `${hours}:${minutes}:${seconds} ${period}`;
    } else {
      timeDisplay = t;
    }
  } else if (eventTimestamp) {
    const date = new Date(eventTimestamp);
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    const period = hours >= 12 ? "p.m." : "a.m.";
    hours = hours % 12 || 12;
    timeDisplay = `${hours}:${minutes}:${seconds} ${period}`;
  }

  // Event type line with inline-code time
  lines.push(`### PVP Kill - \`${timeDisplay}\``);
  lines.push(""); // Blank line

  // Action line with random action verb
  const killerName = killer || "Unknown";
  const victimName = victim || "Unknown";
  const action = getRandomPvpAction(killerName, victimName);
  lines.push(`\`${killerName}\` ${action} \`${victimName}\``);

  // Weapon
  const weaponText = weapon || "N/A";
  lines.push(`**Weapon** ${weaponText}`);

  // Distance
  const distanceText =
    distanceMeters !== null && distanceMeters !== undefined
      ? distanceMeters.toFixed(0)
      : "0";
  lines.push(`**Distance** ${distanceText} meters`);

  // Hit
  const hitZoneText = hitZone || "N/A";
  const damageText =
    damage !== null && damage !== undefined ? damage.toFixed(0) : "N/A";
  lines.push(`**Hit** ${hitZoneText} ${damageText} damage`);

  // Location with iZurvive link
  if (
    victimPosition &&
    victimPosition.x &&
    victimPosition.y &&
    victimPosition.z
  ) {
    const { x, y, z } = victimPosition;
    const coordsText = `${x.toFixed(1)};${y.toFixed(1)};${z.toFixed(1)}`;
    const url = buildIzurviveLocationUrl(x, y);
    lines.push(`**Location** [${coordsText}](${url})`);
  } else {
    lines.push(`**Location** N/A`);
  }

  lines.push(""); // Blank line

  // Killer stats with underline + bold
  lines.push(`__**Killer:**__ \`${killerName}\``);
  if (killerStats) {
    lines.push(
      `**Rank:** ${killerStats.rank} | **Score:** ${killerStats.score.toFixed(1)}`,
    );
    lines.push(
      `**Kills:** ${killerStats.kills} | **Deaths:** ${killerStats.deaths} | **KD:** ${killerStats.kd.toFixed(2)}`,
    );
    lines.push(`**Kill Streak:** ${killerStats.killStreak}`);
  } else {
    lines.push(`**Rank:** N/A | **Score:** N/A`);
    lines.push(`**Kills:** N/A | **Deaths:** N/A | **KD:** N/A`);
    lines.push(`**Kill Streak:** N/A`);
  }

  lines.push(""); // Blank line

  // Victim stats with underline + bold
  lines.push(`__**Victim:**__ \`${victimName}\``);
  if (victimStats) {
    lines.push(
      `**Rank:** ${victimStats.rank} | **Score:** ${victimStats.score.toFixed(1)}`,
    );
    lines.push(
      `**Kills:** ${victimStats.kills} | **Deaths:** ${victimStats.deaths} | **KD:** ${victimStats.kd.toFixed(2)}`,
    );
    const timeAlive = victimStats.lastTimeAlive || "N/A";
    lines.push(`**Time Alive:** ${timeAlive}`);
  } else {
    lines.push(`**Rank:** N/A | **Score:** N/A`);
    lines.push(`**Kills:** N/A | **Deaths:** N/A | **KD:** N/A`);
    lines.push(`**Time Alive:** N/A`);
  }

  return {
    embeds: [
      new EmbedBuilder()
        .setColor(0xe11d48) // Red/pink color
        .setDescription(lines.join("\n"))
        .setFooter({ text: "Bellok's Killfeed" })
        .setTimestamp(eventTimestamp ? new Date(eventTimestamp) : new Date()),
    ],
  };
}

function embedExplosion(
  { victim, device, victimPosition, t },
  eventTimestamp = null,
  victimStats = null,
) {
  const lines = [];

  // Title
  lines.push(`**💥 Killfeed Notification 💥**`);

  // Format time for display
  let timeDisplay = "N/A";
  if (t) {
    // Convert HH:MM:SS to 12-hour format with a.m./p.m.
    const match = t.match(/^(\d{2}):(\d{2}):(\d{2})$/);
    if (match) {
      let hours = parseInt(match[1], 10);
      const minutes = match[2];
      const seconds = match[3];
      const period = hours >= 12 ? "p.m." : "a.m.";
      hours = hours % 12 || 12; // Convert to 12-hour format
      timeDisplay = `${hours}:${minutes}:${seconds} ${period}`;
    } else {
      timeDisplay = t;
    }
  } else if (eventTimestamp) {
    const date = new Date(eventTimestamp);
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    const period = hours >= 12 ? "p.m." : "a.m.";
    hours = hours % 12 || 12;
    timeDisplay = `${hours}:${minutes}:${seconds} ${period}`;
  }

  // Event type line with inline-code time
  lines.push(`### Explosion Death - \`${timeDisplay}\``);
  lines.push(""); // Blank line

  // Victim with explosion phrase
  const victimName = victim || "Unknown";
  const deviceName = device || "explosive";
  lines.push(`\`${victimName}\` died from "${deviceName}" explosion`);

  // Location with iZurvive link
  if (
    victimPosition &&
    victimPosition.x &&
    victimPosition.y &&
    victimPosition.z
  ) {
    const { x, y, z } = victimPosition;
    const coordsText = `${x.toFixed(1)};${y.toFixed(1)};${z.toFixed(1)}`;
    const url = buildIzurviveLocationUrl(x, y);
    lines.push(`**Location** [${coordsText}](${url})`);
  } else {
    lines.push(`**Location** N/A`);
  }

  lines.push(""); // Blank line

  // Victim stats with underline + bold
  lines.push(`__**Victim:**__ \`${victimName}\``);
  if (victimStats) {
    lines.push(
      `**Rank:** ${victimStats.rank} | **Score:** ${victimStats.score.toFixed(1)}`,
    );
    lines.push(
      `**Kills:** ${victimStats.kills} | **Deaths:** ${victimStats.deaths} | **KD:** ${victimStats.kd.toFixed(2)}`,
    );
    const timeAlive = victimStats.lastTimeAlive || "N/A";
    lines.push(`**Time Alive:** ${timeAlive}`);
  } else {
    lines.push(`**Rank:** N/A | **Score:** N/A`);
    lines.push(`**Kills:** N/A | **Deaths:** N/A | **KD:** N/A`);
    lines.push(`**Time Alive:** N/A`);
  }

  return {
    embeds: [
      new EmbedBuilder()
        .setColor(0xf59e0b) // Orange color for explosions
        .setDescription(lines.join("\n"))
        .setFooter({ text: "Bellok's Killfeed" })
        .setTimestamp(eventTimestamp ? new Date(eventTimestamp) : new Date()),
    ],
  };
}

function buildKillEmbed(
  k,
  eventTimestamp = null,
  killerStats = null,
  victimStats = null,
) {
  if (k.type === "pvp")
    return embedPvp(k, eventTimestamp, killerStats, victimStats);
  if (k.type === "explosion")
    return embedExplosion(k, eventTimestamp, victimStats);
  return null;
}

// ================== HEATMAP CLUSTERING ==================
function buildHeatClusters(points) {
  const MERGE_RADIUS_METERS = 125; // 100-150m range for clustering nearby kills
  const clusters = [];

  for (const p of points) {
    let merged = false;
    for (const c of clusters) {
      const dx = p.x - c.x;
      const dy = p.y - c.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= MERGE_RADIUS_METERS) {
        // Merge into this cluster
        c.count++;
        c.x = (c.x * (c.count - 1) + p.x) / c.count;
        c.y = (c.y * (c.count - 1) + p.y) / c.count;
        merged = true;
        break;
      }
    }
    if (!merged) {
      clusters.push({ x: p.x, y: p.y, count: 1 });
    }
  }

  return clusters;
}

// ================== HEATMAP RENDER (compact clustered dots) ==================
// Helper: Draw soft heat bridge between two points using distance-to-line-segment
function drawSoftBridge(png, x1, y1, x2, y2, radius, r, g, b, maxAlpha, W, H) {
  // Bounding box for efficiency
  const minX = Math.max(0, Math.min(x1, x2) - radius - 1);
  const maxX = Math.min(W - 1, Math.max(x1, x2) + radius + 1);
  const minY = Math.max(0, Math.min(y1, y2) - radius - 1);
  const maxY = Math.min(H - 1, Math.max(y1, y2) + radius + 1);

  const dx = x2 - x1;
  const dy = y2 - y1;
  const segmentLengthSq = dx * dx + dy * dy;

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      // Calculate distance from pixel (x,y) to line segment (x1,y1)-(x2,y2)
      let distance;

      if (segmentLengthSq === 0) {
        // Degenerate case: segment is a point
        distance = Math.sqrt((x - x1) ** 2 + (y - y1) ** 2);
      } else {
        // Project point onto line segment
        const t = Math.max(
          0,
          Math.min(1, ((x - x1) * dx + (y - y1) * dy) / segmentLengthSq),
        );
        const projX = x1 + t * dx;
        const projY = y1 + t * dy;
        distance = Math.sqrt((x - projX) ** 2 + (y - projY) ** 2);
      }

      if (distance <= radius) {
        // Soft falloff
        const falloff = 1 - distance / radius;
        const alpha = Math.round(maxAlpha * Math.pow(falloff, 1.5));

        // Alpha blend with existing pixel
        const o = (y * W + x) * 4;
        const existingAlpha = png.data[o + 3];

        if (alpha > existingAlpha) {
          png.data[o + 0] = r;
          png.data[o + 1] = g;
          png.data[o + 2] = b;
          png.data[o + 3] = alpha;
        }
      }
    }
  }
}

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

  // 2) Build clusters from world coordinates
  const hp = loadHeat().points;
  const clusters = buildHeatClusters(hp);

  // 3) Create transparent overlay
  const overlay = new PNG({ width: W, height: H });
  overlay.data.fill(0);

  // 4) Identify 5+ clusters for visual bridge connections
  const fivePlusClusters = clusters.filter((c) => c.count >= 5);
  const bridgeConnections = [];

  // Find pairs of 5+ clusters that should have visual bridges
  for (let i = 0; i < fivePlusClusters.length; i++) {
    for (let j = i + 1; j < fivePlusClusters.length; j++) {
      const c1 = fivePlusClusters[i];
      const c2 = fivePlusClusters[j];

      // Calculate world distance
      const dx = c2.x - c1.x;
      const dy = c2.y - c1.y;
      const worldDist = Math.sqrt(dx * dx + dy * dy);

      // Connect if between 125m and 300m (close but not merged)
      if (worldDist >= 125 && worldDist <= 300) {
        bridgeConnections.push({ c1, c2, worldDist });
      }
    }
  }

  // 5) Draw heat bridges between nearby 5+ clusters (BEFORE drawing dots)
  for (const { c1, c2 } of bridgeConnections) {
    const p1 = mapToPixelCoords(c1.x, c1.y, W, H);
    const p2 = mapToPixelCoords(c2.x, c2.y, W, H);

    // Multi-layer bridge: outer blue → middle green → inner orange
    // Using distance-to-line-segment for true elongated heat corridors
    drawSoftBridge(
      overlay,
      p1.px,
      p1.py,
      p2.px,
      p2.py,
      28,
      59,
      130,
      246,
      95,
      W,
      H,
    ); // Blue outer
    drawSoftBridge(
      overlay,
      p1.px,
      p1.py,
      p2.px,
      p2.py,
      18,
      34,
      197,
      94,
      90,
      W,
      H,
    ); // Green middle
    drawSoftBridge(
      overlay,
      p1.px,
      p1.py,
      p2.px,
      p2.py,
      9,
      234,
      179,
      8,
      70,
      W,
      H,
    ); // Orange inner
  }

  // 6) Draw all clusters as normal radial dots (on top of bridges)
  for (const cluster of clusters) {
    const { px, py } = mapToPixelCoords(cluster.x, cluster.y, W, H);

    // Visual count capped at 5
    const visualCount = Math.min(cluster.count, 5);

    // Clear visibility radii - larger dots for higher counts
    // outer = blue halo, core = green/orange/red center
    let coreRadius, outerRadius;
    if (visualCount === 1) {
      coreRadius = 5;
      outerRadius = 16;
    } else if (visualCount === 2) {
      coreRadius = 7;
      outerRadius = 18;
    } else if (visualCount === 3) {
      coreRadius = 8;
      outerRadius = 21;
    } else if (visualCount === 4) {
      coreRadius = 10;
      outerRadius = 24;
    } else {
      // 5+
      coreRadius = 12;
      outerRadius = 28;
    }

    const maxRadius = outerRadius;

    // Draw radial heat gradient from center outward
    for (let dy = -maxRadius; dy <= maxRadius; dy++) {
      for (let dx = -maxRadius; dx <= maxRadius; dx++) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > maxRadius) continue;

        const x = px + dx;
        const y = py + dy;
        if (x < 0 || x >= W || y < 0 || y >= H) continue;

        // Normalized distance from center (0 = center, 1 = edge)
        const normDist = dist / maxRadius;

        // Moderate falloff for visibility with soft edges
        const falloff = Math.pow(1 - normDist, 1.6);
        const coreRatio = coreRadius / maxRadius;
        let r, g, b, alpha;

        if (visualCount === 1) {
          // 1 kill: blue dot + tiny green center (NO orange)
          if (normDist > 0.5) {
            // Blue outer halo
            r = 59;
            g = 130;
            b = 246; // #3B82F6 blue
            alpha = Math.round(100 + falloff * 30);
          } else if (normDist > coreRatio) {
            // Brighter blue inner
            r = 59;
            g = 130;
            b = 246;
            alpha = Math.round(120 + falloff * 40);
          } else {
            // Tiny green center
            r = 34;
            g = 197;
            b = 94; // #22C55E green
            alpha = Math.round(145 + falloff * 30);
          }
        } else if (visualCount === 2) {
          // 2 kills: blue halo + clearly visible green center (NO orange)
          if (normDist > 0.55) {
            // Blue outer halo
            r = 59;
            g = 130;
            b = 246; // #3B82F6
            alpha = Math.round(85 + falloff * 30);
          } else if (normDist > coreRatio * 1.2) {
            // Blue-green transition
            const t = (normDist - coreRatio * 1.2) / (0.55 - coreRatio * 1.2);
            r = Math.round(59 + (34 - 59) * (1 - t));
            g = Math.round(130 + (197 - 130) * (1 - t));
            b = Math.round(246 + (94 - 246) * (1 - t));
            alpha = Math.round(120 + falloff * 40);
          } else {
            // Clear bright green center
            r = 74;
            g = 222;
            b = 128; // #4ADE80 bright green
            alpha = Math.round(150 + falloff * 30);
          }
        } else if (visualCount === 3) {
          // 3 kills: blue/green + small orange center (FIRST orange appearance)
          if (normDist > 0.6) {
            // Blue outer halo
            r = 59;
            g = 130;
            b = 246; // #3B82F6
            alpha = Math.round(90 + falloff * 30);
          } else if (normDist > coreRatio * 1.5) {
            // Green mid layer
            r = 34;
            g = 197;
            b = 94; // #22C55E
            alpha = Math.round(135 + falloff * 40);
          } else if (normDist > coreRatio) {
            // Yellow transition
            r = 234;
            g = 179;
            b = 8; // #EAB308 yellow
            alpha = Math.round(165 + falloff * 35);
          } else {
            // Small orange center
            r = 251;
            g = 146;
            b = 60; // #FB923C orange
            alpha = Math.round(190 + falloff * 30);
          }
        } else if (visualCount === 4) {
          // 4 kills: blue/green + larger orange center
          if (normDist > 0.62) {
            // Blue outer halo
            r = 59;
            g = 130;
            b = 246; // #3B82F6
            alpha = Math.round(95 + falloff * 30);
          } else if (normDist > coreRatio * 1.6) {
            // Green mid layer
            r = 34;
            g = 197;
            b = 94; // #22C55E
            alpha = Math.round(145 + falloff * 40);
          } else if (normDist > coreRatio * 1.1) {
            // Yellow layer
            r = 234;
            g = 179;
            b = 8; // #EAB308
            alpha = Math.round(175 + falloff * 30);
          } else {
            // Larger bright orange center
            r = 249;
            g = 115;
            b = 22; // #F97316 orange
            alpha = Math.round(200 + falloff * 25);
          }
        } else {
          // 5+ kills: blue/green + strong orange/red center
          if (normDist > 0.65) {
            // Blue outer halo
            r = 59;
            g = 130;
            b = 246; // #3B82F6
            alpha = Math.round(100 + falloff * 30);
          } else if (normDist > coreRatio * 1.7) {
            // Green mid layer
            r = 34;
            g = 197;
            b = 94; // #22C55E
            alpha = Math.round(155 + falloff * 40);
          } else if (normDist > coreRatio * 1.2) {
            // Yellow layer
            r = 234;
            g = 179;
            b = 8; // #EAB308
            alpha = Math.round(180 + falloff * 30);
          } else if (normDist > coreRatio * 0.6) {
            // Orange layer
            r = 249;
            g = 115;
            b = 22; // #F97316
            alpha = Math.round(205 + falloff * 25);
          } else {
            // Strong red center
            r = 239;
            g = 68;
            b = 68; // #EF4444 red
            alpha = Math.round(215 + falloff * 15);
          }
        }

        const o = (y * W + x) * 4;
        if (overlay.data[o + 3] < alpha) {
          overlay.data[o + 0] = r;
          overlay.data[o + 1] = g;
          overlay.data[o + 2] = b;
          overlay.data[o + 3] = alpha;
        }
      }
    }
  }

  // 7) Compose onto base map
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

    // Create embed for heatmap
    const updatedTimestamp = Math.floor((now - 60_000) / 1000);
    const embed = new EmbedBuilder()
      .setTitle("🗺️ • PvP Heatmap")
      .setDescription(
        `• **Updated:** <t:${updatedTimestamp}:R>\n` +
          `• **Entries:** ${h.points.length}`,
      )
      .setImage(`attachment://${HEAT_IMG_PATH.split("/").pop()}`)
      .setColor(0x00ae86)
      .setFooter({ text: "Bellok's Killfeed • Chernarus" })
      .setTimestamp(now);

    const payload = { content: "", embeds: [embed], files: [file] };

    // Try to edit existing message, or send new one if it doesn't exist
    let sent = false;
    if (h.messageId) {
      try {
        const existingMsg = await ch.messages
          .fetch(h.messageId)
          .catch(() => null);
        if (existingMsg) {
          await existingMsg.edit(payload);
          sent = true;
          console.log("[heatmap] edited existing message", h.messageId);
        } else {
          console.log("[heatmap] previous message not found, sending new one");
          h.messageId = null;
        }
      } catch (e) {
        console.warn(
          "[heatmap] failed to edit message, sending new one:",
          e?.code || e?.message,
        );
        h.messageId = null;
      }
    }

    // Send new message if we couldn't edit
    if (!sent) {
      const newMsg = await ch.send(payload);
      h.messageId = newMsg.id;
      console.log("[heatmap] sent new message", h.messageId);
    }

    h.lastSentCount = h.points.length;
    h.lastUpdate = now;
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
      // Check and send heatmap first, before ADM processing
      // This ensures heatmap updates even if CURRENT_ADM is missing
      await maybeSendHeatmap(client);

      // Check and send weekend heatmap (independent of PvP heatmap)
      await maybeSendWeekendHeatmap(client);

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

      for (const [key, k] of groups) {
        if (alreadySentBucket(key)) continue;

        // Queue the killfeed event for batched delivery instead of sending immediately
        queueKillfeedEvent(
          {
            kill: k,
            line: lines.find(
              (l) =>
                l.includes(`"${k.victim}"`) && (k.t ? l.startsWith(k.t) : true),
            ),
          },
          key,
        );

        // sumar punto al heatmap con la última posición conocida de la víctima
        const pos = posForVictimFromLine(k.victim, k.line || "");
        if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y))
          addHeatPoint(pos.x, pos.y);
      }
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

    // Register slash commands
    if (config.CLIENT_ID) {
      try {
        await registerCommands(config.DISCORD_TOKEN, config.CLIENT_ID);
      } catch (error) {
        console.warn(
          "[commands] Failed to register slash commands:",
          error.message,
        );
      }
    } else {
      console.warn(
        "[commands] DISCORD_CLIENT_ID not set, skipping command registration",
      );
    }

    await ensureLatestAdmSelected();
    setInterval(tick, POLL_MS);

    // Start killfeed flush interval (every 10 minutes)
    setInterval(() => flushKillfeedQueue(client), KILLFEED_FLUSH_INTERVAL_MS);
    console.log(
      `[killfeed] Flush interval started (every ${KILLFEED_FLUSH_INTERVAL_MS / 60000} minutes)`,
    );
  });

  // Handle slash command interactions
  client.on("interactionCreate", handleCommandInteraction);

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

// ================== MOCK PARSE ==================
async function runMockParse() {
  // Accept optional file path from command line, default to sample-adm.txt
  const mockLogPath = process.argv[3] || "./mock/sample-adm.txt";
  console.log(`[mock-parse] Reading ${mockLogPath}...\n`);

  if (!fs.existsSync(mockLogPath)) {
    console.error(`[mock-parse] ERROR: File not found: ${mockLogPath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(mockLogPath, "utf8");
  const lines = content.split(/\r?\n/).filter(Boolean);

  console.log(`[mock-parse] Total lines: ${lines.length}\n`);

  let pvpCount = 0;
  let explosionCount = 0;

  // Load existing stats from JSON file (empty object if file doesn't exist)
  const stats = loadMockStats();
  console.log(
    `[mock-parse] Loaded stats for ${Object.keys(stats).length} players from persistent storage.\n`,
  );

  // Normalized chronological time tracking for midnight rollover
  let previousRawTimeMs = null;
  let dayOffsetMs = 0;

  /**
   * Parse HH:MM:SS to raw milliseconds since midnight
   */
  function parseRawTimeMs(timeStr) {
    if (!timeStr) return null;
    const match = timeStr.match(/^(\d{2}):(\d{2}):(\d{2})$/);
    if (!match) return null;

    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const seconds = parseInt(match[3], 10);

    return (hours * 3600 + minutes * 60 + seconds) * 1000;
  }

  /**
   * Get normalized chronological event time, handling midnight rollover
   */
  function getNormalizedEventTimeMs(timeStr) {
    const rawTimeMs = parseRawTimeMs(timeStr);
    if (rawTimeMs === null) return null;

    // Detect midnight rollover: current time is less than previous time
    if (previousRawTimeMs !== null && rawTimeMs < previousRawTimeMs) {
      dayOffsetMs += 86400000; // Add 24 hours in milliseconds
      console.log(
        `[mock-parse] Midnight rollover detected at ${timeStr}, dayOffset now: ${dayOffsetMs / 3600000}h`,
      );
    }

    previousRawTimeMs = rawTimeMs;
    return dayOffsetMs + rawTimeMs;
  }

  for (const line of lines) {
    // Extract time from line
    const timeMatch = line.match(/^\s*(\d{2}:\d{2}:\d{2})\s*\|/);
    const timeStr = timeMatch ? timeMatch[1] : null;
    const normalizedTimeMs = getNormalizedEventTimeMs(timeStr);

    // Check for connect/disconnect events first
    const connectMatch = line.match(
      /Player\s+["'""](.+?)["'""].*?\(id=\d+\)\s+is connected/i,
    );
    if (connectMatch) {
      const playerName = connectMatch[1].trim();
      handlePlayerConnect(stats, playerName, normalizedTimeMs);
      console.log(`🔌 CONNECT: ${playerName} connected at ${timeStr}`);
      continue;
    }

    const disconnectMatch = line.match(
      /Player\s+["'""](.+?)["'""].*?\(id=\d+\)\s+has been disconnected/i,
    );
    if (disconnectMatch) {
      const playerName = disconnectMatch[1].trim();
      handlePlayerDisconnect(stats, playerName, normalizedTimeMs);
      console.log(`🔌 DISCONNECT: ${playerName} disconnected at ${timeStr}`);
      continue;
    }

    // Parse kill events
    const event = parseKill(line);
    if (event) {
      // Update stats before displaying
      updateStatsFromEvent(stats, event, normalizedTimeMs);

      console.log("✅ DETECTED:");
      console.log(`  Type: ${event.type}`);

      if (event.type === "pvp") {
        console.log(`  Killer: ${event.killer}`);
        console.log(`  Victim: ${event.victim}`);
        console.log(`  Weapon: ${event.weapon || "N/A"}`);
        console.log(
          `  Distance: ${event.distanceMeters ? event.distanceMeters + " meters" : "N/A"}`,
        );
        console.log(`  Ammo: ${event.ammo || "N/A"}`);
        console.log(`  Hit Zone: ${event.hitZone || "N/A"}`);
        console.log(`  Damage: ${event.damage || "N/A"}`);

        if (event.killerPosition) {
          console.log(
            `  Killer Location: ${event.killerPosition.x.toFixed(1)};${event.killerPosition.y.toFixed(1)};${event.killerPosition.z.toFixed(1)}`,
          );
        } else {
          console.log(`  Killer Location: N/A`);
        }

        if (event.victimPosition) {
          console.log(
            `  Victim Location: ${event.victimPosition.x.toFixed(1)};${event.victimPosition.y.toFixed(1)};${event.victimPosition.z.toFixed(1)}`,
          );
        } else {
          console.log(`  Victim Location: N/A`);
        }

        console.log(`  Time: ${event.t || "N/A"}`);
        pvpCount++;
      } else if (event.type === "explosion") {
        console.log(`  Victim: ${event.victim}`);
        console.log(`  Device: ${event.device || "N/A"}`);

        if (event.victimPosition) {
          console.log(
            `  Location: ${event.victimPosition.x.toFixed(1)};${event.victimPosition.y.toFixed(1)};${event.victimPosition.z.toFixed(1)}`,
          );
        } else {
          console.log(`  Location: N/A`);
        }

        console.log(`  Time: ${event.t || "N/A"}`);
        explosionCount++;
      }

      // Get killer and victim stats for formatted notification
      const killerStats = event.killer
        ? getPlayerStats(stats, event.killer)
        : null;
      const victimStats = event.victim
        ? getPlayerStats(stats, event.victim)
        : null;

      // Print formatted killfeed notification with stats
      console.log("\n📋 FORMATTED KILLFEED NOTIFICATION:");
      console.log(formatKillfeedNotification(event, killerStats, victimStats));

      console.log(""); // Empty line for readability
    } else {
      console.log(
        "❌ No kill event:",
        line.slice(0, 80) + (line.length > 80 ? "..." : ""),
      );
    }
  }

  console.log(
    `\n[mock-parse] Summary: ${pvpCount} PvP kills, ${explosionCount} explosions detected.`,
  );

  // Save updated stats to JSON file
  saveMockStats(stats);
  console.log(
    `[mock-parse] Saved stats for ${Object.keys(stats).length} players to persistent storage.`,
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
} else if (MODE === "mock-parse") {
  runMockParse();
} else {
  runBot();
}
