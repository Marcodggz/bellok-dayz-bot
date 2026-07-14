// index.js — DayZ Nitrado PS4 → Discord Kill-feed + Heatmap
// - PvP kills: red embed with killer/victim/weapon details
// - Explosion deaths: orange embed
// - PvP Heatmap: single editable message with clustered death locations
// - Weekend Heatmap: single editable message with player position density (Fri-Sun only)
// - Coordinate calibration: min/max/offset/scale/flip for accurate map overlay

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
const { buildKillEmbed } = require("./src/features/killfeed/embedBuilders");
const {
  KILLFEED_FLUSH_INTERVAL_MS,
  queueKillfeedEvent,
  flushKillfeedQueue,
} = require("./src/features/killfeed/killfeedQueue");
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
const { mapToPixelCoords } = require("./src/utils/coordinateMapper");
const {
  buildHeatClusters,
  drawHeatCluster,
  composeHeatmapOverlay,
  drawSoftBridge,
} = require("./src/utils/heatmapRenderer");
const {
  runDiscordTest,
  runDiscordHeatmapTest,
  runDiagnose,
  runMockParse,
  runDiscordWeekendHeatmapTest,
} = require("./src/cli");

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

// ================== PVP HEATMAP STATE ==================
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

// ================== ADM FILE ROTATION ==================
let CURRENT_ADM = null;
let INITIALIZED = false;

async function ensureLatestAdmSelected() {
  if (!ADM_DIR) {
    console.warn("[rotate] Missing NITRADO_ADM_DIR");
    return;
  }
  const rows = await listAdmNames(ADM_DIR, !INITIALIZED /*force*/);
  if (!rows.length) {
    if (DEBUG) console.log("[rotate] No ADM files found");
    return;
  }
  const latest = rows[0].path;
  if (latest !== CURRENT_ADM) {
    CURRENT_ADM = latest;
    console.log("[rotate] New ADM file →", CURRENT_ADM);
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

// ================== PLAYER POSITIONS ==================
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

// ================== KILL EVENT DEDUPLICATION (20s buckets) ==================
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

// ================== HEATMAP RENDER (compact clustered dots) ==================
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
    const visualCount = Math.min(cluster.count, 5);
    drawHeatCluster(overlay, px, py, visualCount, W, H);
  }

  // 7) Compose onto base map
  const outPng = composeHeatmapOverlay(basePng, overlay, W, H);

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
      "Missing .env variables: NITRADO_TOKEN, NITRADO_SERVICE_ID, DISCORD_CHANNEL_ID, DISCORD_TOKEN",
    );
    process.exit(1);
  }
  if (!ADM_DIR && MODE === "run") {
    console.error(
      "Missing NITRADO_ADM_DIR (should point to /noftp/.../dayzps/config)",
    );
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
      console.warn("[heatmap] Invalid channel or missing permissions");
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
      await maybeSendHeatmap(client);
      await maybeSendWeekendHeatmap(client);

      await ensureLatestAdmSelected();
      if (!CURRENT_ADM) {
        if (DEBUG_TICKS) console.log("[tick] No current ADM file");
        return;
      }

      const lines = await readNewLines(CURRENT_ADM);
      if (DEBUG_TICKS)
        console.log(
          `[tick] ${new Date().toLocaleTimeString()}  +${lines.length} new lines`,
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

      // Group by victim + 20s time bucket, prioritize PvP over explosion
      const groups = new Map();
      for (const k of events) {
        const key = victimBucketKey(k.victim, k.t);
        const cur = groups.get(key);
        if (!cur || typeRank(k.type) > typeRank(cur.type)) groups.set(key, k);
      }

      for (const [key, k] of groups) {
        if (alreadySentBucket(key)) continue;

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

        const pos = posForVictimFromLine(k.victim, k.line || "");
        if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y))
          addHeatPoint(pos.x, pos.y);
      }
    } catch (e) {
      const status = e?.response?.status;
      const txt = bufToText(e?.response?.data);
      if (looksLikeHtml(txt) || status === 429 || looksLikeRateLimit(txt)) {
        if (Date.now() >= listCooldownUntil)
          console.warn("[tick] Nitrado busy; entering cooldown");
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
    console.log(`✅ Bot online as ${client.user.tag}`);

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
    setInterval(
      () => flushKillfeedQueue(client, CHANNEL_ID, DEBUG, RAW_TO_DISCORD),
      KILLFEED_FLUSH_INTERVAL_MS,
    );
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

// ================== MAIN ==================
if (MODE === "discord-test") {
  runDiscordTest(config, checkEnv);
} else if (MODE === "discord-heatmap-test") {
  runDiscordHeatmapTest(config, checkEnv);
} else if (MODE === "discord-weekend-heatmap-test") {
  runDiscordWeekendHeatmapTest(config, checkEnv);
} else if (MODE === "diagnose") {
  runDiagnose(
    config,
    checkEnv,
    listAdmNames,
    tsFromName,
    tMadrid,
    nitDownload,
    parseKill,
  );
} else if (MODE === "mock-parse") {
  runMockParse(
    parseKill,
    loadMockStats,
    saveMockStats,
    handlePlayerConnect,
    handlePlayerDisconnect,
    updateStatsFromEvent,
    getPlayerStats,
    formatKillfeedNotification,
  );
} else {
  runBot();
}
