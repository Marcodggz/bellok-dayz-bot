// src/utils/weekendHeatmapHelpers.js — Weekend Heatmap utilities

const { PNG } = require("pngjs");
const fs = require("fs");
const { clamp } = require("./helpers");
const { mapToPixelCoords } = require("./coordinateMapper");
const {
  buildHeatClusters,
  drawHeatCluster,
  composeHeatmapOverlay,
} = require("./heatmapRenderer");
const {
  loadWeekendHeat,
  saveWeekendHeat,
} = require("../storage/weekendHeatStore");
const {
  WEEKEND_HEATMAP_WINDOW_MIN,
  WEEKEND_HEATMAP_INTERVAL_MS,
  WEEKEND_HEATMAP_CHANNEL_ID,
  WEEKEND_HEATMAP_IMG_PATH,
  CHERNARUS_MAP_PATH,
  HEATMAP_WIDTH,
  HEATMAP_HEIGHT,
  MAP_SIZE,
} = require("../config/config");
const { EmbedBuilder, AttachmentBuilder } = require("discord.js");

/**
 * Weekend heatmap runs on Friday, Saturday, and Sunday
 * @param {Date} date - Date to check (defaults to now)
 * @returns {boolean} True if Friday, Saturday, or Sunday
 */
function isWeekendHeatmapActive(date = new Date()) {
  const day = date.getDay();
  return day === 0 || day === 5 || day === 6;
}

/**
 * Track player position for weekend heatmap (Fri-Sun only)
 * @param {string} name - Player name
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 */
function addWeekendHeatPoint(name, x, y) {
  if (!isWeekendHeatmapActive()) return;

  const wh = loadWeekendHeat();
  const ts = Date.now();

  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  if (x < 0 || x > MAP_SIZE || y < 0 || y > MAP_SIZE) return;

  // Prevent duplicate positions within 5-second window
  const recentDuplicate = wh.points.some(
    (p) =>
      p.name === name &&
      Math.abs(p.x - x) < 1 &&
      Math.abs(p.y - y) < 1 &&
      ts - p.ts < 5000,
  );

  if (recentDuplicate) return;

  wh.points.push({
    name,
    x: clamp(x, 0, MAP_SIZE),
    y: clamp(y, 0, MAP_SIZE),
    ts,
  });

  saveWeekendHeat(wh);
}

function pruneWeekendHeat(wh) {
  const minTs = Date.now() - WEEKEND_HEATMAP_WINDOW_MIN * 60 * 1000;
  wh.points = wh.points.filter((p) => p.ts >= minTs);
}

/**
 * Render weekend heatmap image
 * @param {Array} points - Array of {name, x, y, ts} points
 * @param {string} outPath - Output image path
 * @param {string} baseMapPath - Base map image path
 */
function renderWeekendHeatPng(points, outPath, baseMapPath = "") {
  let basePng = null;
  let W = HEATMAP_WIDTH;
  let H = HEATMAP_HEIGHT;

  // Load base map if exists
  try {
    if (baseMapPath && fs.existsSync(baseMapPath)) {
      const buf = fs.readFileSync(baseMapPath);
      basePng = PNG.sync.read(buf);
      W = basePng.width;
      H = basePng.height;
    }
  } catch (e) {
    console.warn(
      "[weekend-heatmap] Could not read base map, using transparent canvas:",
      e.message,
    );
  }

  // Build clusters
  const clusters = buildHeatClusters(points);

  // Create transparent overlay
  const overlay = new PNG({ width: W, height: H });
  overlay.data.fill(0);

  // Draw all clusters as radial dots
  for (const cluster of clusters) {
    const { px, py } = mapToPixelCoords(cluster.x, cluster.y, W, H);
    const visualCount = Math.min(cluster.count, 5);
    drawHeatCluster(overlay, px, py, visualCount, W, H);
  }

  // Compose onto base map
  const outPng = composeHeatmapOverlay(basePng, overlay, W, H);

  fs.writeFileSync(outPath, PNG.sync.write(outPng));
}

/**
 * Send or update weekend heatmap message
 * @param {Client} client - Discord client
 */
async function maybeSendWeekendHeatmap(client) {
  if (!WEEKEND_HEATMAP_CHANNEL_ID) return;

  // Only send/update on Friday, Saturday, Sunday
  if (!isWeekendHeatmapActive()) {
    return;
  }

  const now = Date.now();
  const wh = loadWeekendHeat();

  // Respect interval
  if (now - wh.lastUpdate < WEEKEND_HEATMAP_INTERVAL_MS) return;

  // Prune old points
  pruneWeekendHeat(wh);

  // Skip if no points
  if (!wh.points.length) {
    console.log("[weekend-heatmap] No points to render");
    return;
  }

  try {
    // Render image
    renderWeekendHeatPng(
      wh.points,
      WEEKEND_HEATMAP_IMG_PATH,
      CHERNARUS_MAP_PATH,
    );
    await new Promise((r) => setTimeout(r, 80));

    // Fetch channel
    const ch = await client.channels
      .fetch(WEEKEND_HEATMAP_CHANNEL_ID)
      .catch(() => null);
    if (!ch || typeof ch.send !== "function") {
      console.warn("[weekend-heatmap] Invalid channel");
      return;
    }

    // Build embed
    const updatedTimestamp = Math.floor((now - 60_000) / 1000);
    const file = new AttachmentBuilder(WEEKEND_HEATMAP_IMG_PATH);
    const embed = new EmbedBuilder()
      .setTitle("🗺️ • Weekend Heatmap")
      .setDescription(
        `• **Updated:** <t:${updatedTimestamp}:R>\n` +
          `• **Entries:** ${wh.points.length}`,
      )
      .setImage(`attachment://${WEEKEND_HEATMAP_IMG_PATH.split("/").pop()}`)
      .setColor(0x00ae86)
      .setFooter({ text: "Bellok's Killfeed • Chernarus" })
      .setTimestamp(now);

    const payload = { content: "", embeds: [embed], files: [file] };

    // Try to edit existing message, or send new one
    let sent = false;
    if (wh.messageId) {
      try {
        const existingMsg = await ch.messages
          .fetch(wh.messageId)
          .catch(() => null);
        if (existingMsg) {
          await existingMsg.edit(payload);
          sent = true;
          console.log(
            "[weekend-heatmap] Edited existing message",
            wh.messageId,
          );
        } else {
          console.log(
            "[weekend-heatmap] Previous message not found, sending new one",
          );
          wh.messageId = null;
        }
      } catch (e) {
        console.warn(
          "[weekend-heatmap] Failed to edit message, sending new one:",
          e?.code || e?.message,
        );
        wh.messageId = null;
      }
    }

    // Send new message if we couldn't edit
    if (!sent) {
      const newMsg = await ch.send(payload);
      wh.messageId = newMsg.id;
      console.log("[weekend-heatmap] Sent new message", wh.messageId);
    }

    wh.lastUpdate = now;
    saveWeekendHeat(wh);
  } catch (e) {
    console.warn("[weekend-heatmap] Send error:", e?.code || e?.message || e);
  }
}

module.exports = {
  isWeekendHeatmapActive,
  addWeekendHeatPoint,
  maybeSendWeekendHeatmap,
};
