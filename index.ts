// index.js — DayZ Nitrado PS4 → Discord Kill-feed + Heatmap
// - PvP kills: red embed with killer/victim/weapon details
// - Explosion deaths: orange embed
// - PvP Heatmap: single editable message with clustered death locations
// - Weekend Heatmap: single editable message with player position density (Fri-Sun only)
// - Coordinate calibration: min/max/offset/scale/flip for accurate map overlay

import type { PersistedPlayerStatsCollection } from "./src/types/domainPersistence";

const fs = require("fs");
const { Client, GatewayIntentBits, EmbedBuilder, AttachmentBuilder } = require("discord.js");
const { PNG } = require("pngjs");

// Import config and helpers
const config = require("./src/config/config");
const {
  bufToText,
  looksLikeHtml,
  looksLikeRateLimit,
  tMadrid,
  clamp,
} = require("./src/utils/helpers");
const { loadHeat, saveHeat } = require("./src/storage/heatStore");
const { loadMockStats, saveMockStats } = require("./src/storage/mockStatsStore");
const { loadPlayerStats, savePlayerStats } = require("./src/storage/playerStatsStore");
const { parseKill } = require("./src/parsers/killParser");
const {
  formatKillfeedNotification,
} = require("./src/features/killfeed/formatKillfeedNotification");
const {
  KILLFEED_FLUSH_INTERVAL_MS,
  flushKillfeedQueue,
} = require("./src/features/killfeed/killfeedQueue");
const {
  updateStatsFromEvent,
  getPlayerStats,
  handlePlayerConnect,
  handlePlayerDisconnect,
} = require("./src/features/stats/playerStats");
const {
  createEventTimeNormalizer,
  processPlayerSessionLine,
} = require("./src/features/stats/playerSessionProcessor");
const { handleCommandInteraction } = require("./src/features/commands/commandHandler");
const { registerCommands } = require("./src/features/commands/registerCommands");
const { maybeSendWeekendHeatmap } = require("./src/utils/weekendHeatmapHelpers");
const { mapToPixelCoords } = require("./src/utils/coordinateMapper");
const { createHeatmapCycle } = require("./src/utils/heatmapCycle");
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
const {
  nitDownload,
  listAdmNames,
  tsFromName,
  startListCooldown,
} = require("./src/api/nitradoClient");
const { ensureLatestAdmSelected, readNewLines } = require("./src/features/polling/admFilePoller");
const { processKillEvents } = require("./src/features/killfeed/killEventProcessor");
const { handleKillEvents } = require("./src/features/killfeed/killEventHandler");

const MODE = process.argv[2] || "run";

// Destructure config for convenience
const {
  SERVICE_ID,
  NIT_TOKEN,
  ADM_DIR,
  CHANNEL_ID,
  HEATMAP_CHANNEL_ID,
  RAW_TO_DISCORD,
  DEBUG,
  DEBUG_TICKS,
  POLL_MS,
  LIST_COOLDOWN_MS,
  HEATMAP_INTERVAL_MS,
  HEATMAP_WIDTH,
  HEATMAP_HEIGHT,
  MAP_SIZE,
  HEATMAP_WINDOW_MIN,
  MAP_IMAGE_PATH,
  MAP_DISPLAY_NAME,
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
    console.warn("[heatmap] no se pudo leer MAP_IMAGE_PATH, uso lienzo transparente:", e.message);
  }

  // 2) Build clusters from the already-pruned world coordinates
  const clusters = buildHeatClusters(points);

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
    drawSoftBridge(overlay, p1.px, p1.py, p2.px, p2.py, 28, 59, 130, 246, 95, W, H); // Blue outer
    drawSoftBridge(overlay, p1.px, p1.py, p2.px, p2.py, 18, 34, 197, 94, 90, W, H); // Green middle
    drawSoftBridge(overlay, p1.px, p1.py, p2.px, p2.py, 9, 234, 179, 8, 70, W, H); // Orange inner
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
    !!HEATMAP_CHANNEL_ID
  );
  if (!NIT_TOKEN || !SERVICE_ID || !CHANNEL_ID || !config.DISCORD_TOKEN) {
    console.error(
      "Missing .env variables: NITRADO_TOKEN, NITRADO_SERVICE_ID, DISCORD_CHANNEL_ID, DISCORD_TOKEN"
    );
    process.exit(1);
  }
  if (!ADM_DIR && MODE === "run") {
    console.error("Missing NITRADO_ADM_DIR (should point to /noftp/.../dayzps/config)");
    process.exit(1);
  }
}

// ================== LOOP PRINCIPAL ==================
let heatmapSending = false;

async function maybeSendHeatmap(client) {
  if (!HEATMAP_CHANNEL_ID) return;

  const now = Date.now();

  const h = loadHeat();
  const previousPointCount = h.points.length;
  pruneHeat(h);

  if (h.points.length !== previousPointCount) {
    saveHeat(h);
  }

  if (heatmapSending) return;
  heatmapSending = true;

  try {
    const ch = await client.channels.fetch(HEATMAP_CHANNEL_ID).catch(() => null);

    if (!ch || typeof ch.send !== "function") {
      console.warn("[heatmap] Invalid channel or missing permissions");
      return;
    }

    const updatedTimestamp = Math.floor(now / 1000);
    const embed = new EmbedBuilder()
      .setTitle("🗺️ • PvP Heatmap")
      .setColor(0x00ae86)
      .setFooter({ text: `Bellok's Killfeed • ${MAP_DISPLAY_NAME}` })
      .setTimestamp(now);

    let payload;

    if (h.points.length) {
      renderHeatPng(h.points, HEAT_IMG_PATH, MAP_IMAGE_PATH);
      await new Promise((r) => setTimeout(r, 80));

      const file = new AttachmentBuilder(HEAT_IMG_PATH);

      embed
        .setDescription(
          `• **Updated:** <t:${updatedTimestamp}:R>\n` + `• **Entries:** ${h.points.length}`
        )
        .setImage(`attachment://${HEAT_IMG_PATH.split("/").pop()}`);

      payload = { content: "", embeds: [embed], files: [file] };
    } else {
      embed.setDescription(`No PvP activity in the last ${HEATMAP_WINDOW_MIN} minutes.`);

      payload = {
        content: "",
        embeds: [embed],
        files: [],
        attachments: [],
      };
    }

    // Try to edit existing message, or send new one if it doesn't exist
    let sent = false;
    if (h.messageId) {
      try {
        const existingMsg = await ch.messages.fetch(h.messageId).catch(() => null);
        if (existingMsg) {
          await existingMsg.edit(payload);
          sent = true;
          console.log("[heatmap] edited existing message", h.messageId);
        } else {
          console.log("[heatmap] previous message not found, sending new one");
          h.messageId = null;
        }
      } catch (e) {
        console.warn("[heatmap] failed to edit message, sending new one:", e?.code || e?.message);
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
  } catch (e) {
    console.warn("[heatmap] send error:", e?.code || e?.message || e);
  } finally {
    heatmapSending = false;
  }
}

async function runBot() {
  checkEnv();
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  const stats: PersistedPlayerStatsCollection = loadPlayerStats();
  const normalizeEventTime = createEventTimeNormalizer();
  let readyOnce = false;

  const maybeRunHeatmapCycle = createHeatmapCycle({
    intervalMs: HEATMAP_INTERVAL_MS,
    runCycle: async () => {
      await maybeSendHeatmap(client);
      await maybeSendWeekendHeatmap(client);
    },
  });

  // Active sessions cannot safely continue across bot restarts because ADM
  // timestamps are normalized relative to the current process.
  let resetStaleSessions = false;
  for (const playerStats of Object.values(stats)) {
    if (playerStats.isConnected || playerStats.connectedSince !== null) {
      playerStats.isConnected = false;
      playerStats.connectedSince = null;
      resetStaleSessions = true;
    }
  }

  if (resetStaleSessions) {
    savePlayerStats(stats);
  }

  async function tick() {
    try {
      await maybeRunHeatmapCycle();

      const currentAdm = await ensureLatestAdmSelected();
      if (!currentAdm) {
        if (DEBUG_TICKS) console.log("[tick] No current ADM file");
        return;
      }

      const lines = await readNewLines(currentAdm);
      if (DEBUG_TICKS)
        console.log(`[tick] ${new Date().toLocaleTimeString()}  +${lines.length} new lines`);
      if (!lines.length) {
        return;
      }

      const normalizedEventTimes = new Map();
      const groups = processKillEvents(lines);

      const processSessionLine = (line) => {
        const sessionEvent = processPlayerSessionLine(
          line,
          stats,
          normalizeEventTime,
          handlePlayerConnect,
          handlePlayerDisconnect
        );

        normalizedEventTimes.set(line, sessionEvent.normalizedTimeMs);
      };

      const heatmapPoints = handleKillEvents(
        groups,
        lines,
        stats,
        normalizedEventTimes,
        processSessionLine
      );

      savePlayerStats(stats);

      for (const pos of heatmapPoints) {
        addHeatPoint(pos.x, pos.y);
      }
    } catch (e) {
      const status = e?.response?.status;
      const txt = bufToText(e?.response?.data);
      if (looksLikeHtml(txt) || status === 429 || looksLikeRateLimit(txt)) {
        if (startListCooldown(LIST_COOLDOWN_MS)) {
          console.warn("[tick] Nitrado busy; entering cooldown");
        }
      } else {
        console.warn("[tick] error:", status || "", (txt || e.message).slice(0, 200));
      }
    }
  }

  client.once("clientReady", async () => {
    if (readyOnce) return;
    readyOnce = true;
    console.log(`✅ Bot online as ${client.user.tag}`);

    // Register slash commands
    if (config.CLIENT_ID) {
      try {
        await registerCommands(config.DISCORD_TOKEN, config.CLIENT_ID);
      } catch (error) {
        console.warn("[commands] Failed to register slash commands:", error.message);
      }
    } else {
      console.warn("[commands] DISCORD_CLIENT_ID not set, skipping command registration");
    }

    await ensureLatestAdmSelected();
    setInterval(tick, POLL_MS);

    // Start killfeed flush interval (every 10 minutes)
    setInterval(
      () => flushKillfeedQueue(client, CHANNEL_ID, DEBUG, RAW_TO_DISCORD),
      KILLFEED_FLUSH_INTERVAL_MS
    );
    console.log(
      `[killfeed] Flush interval started (every ${KILLFEED_FLUSH_INTERVAL_MS / 60000} minutes)`
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
  runDiagnose(config, checkEnv, listAdmNames, tsFromName, tMadrid, nitDownload, parseKill);
} else if (MODE === "mock-parse") {
  runMockParse(
    parseKill,
    loadMockStats,
    saveMockStats,
    handlePlayerConnect,
    handlePlayerDisconnect,
    updateStatsFromEvent,
    getPlayerStats,
    formatKillfeedNotification
  );
} else {
  runBot();
}
