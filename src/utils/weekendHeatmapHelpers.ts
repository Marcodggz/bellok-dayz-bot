// src/utils/weekendHeatmapHelpers.ts — Weekend Heatmap utilities

import { PNG } from "pngjs";
import fs from "node:fs";
import { clamp } from "./helpers.js";
import { mapToPixelCoords } from "./coordinateMapper.js";
import {
  buildHeatClusters,
  drawHeatCluster,
  composeHeatmapOverlay,
  drawSoftBridge,
} from "./heatmapRenderer.js";
import { loadWeekendHeat, saveWeekendHeat } from "../storage/weekendHeatStore.js";
import {
  WEEKEND_HEATMAP_WINDOW_MIN,
  WEEKEND_HEATMAP_CHANNEL_ID,
  WEEKEND_HEATMAP_IMG_PATH,
  MAP_IMAGE_PATH,
  MAP_DISPLAY_NAME,
  HEATMAP_WIDTH,
  HEATMAP_HEIGHT,
  MAP_SIZE,
} from "../config/config.js";
import { AttachmentBuilder, EmbedBuilder } from "discord.js";

// Prevent concurrent weekend heatmap sends
let weekendHeatmapSending = false;

/**
 * Weekend heatmap runs on Friday, Saturday, and Sunday
 * @param {Date} date - Date to check (defaults to now)
 * @returns {boolean} True if Friday, Saturday, or Sunday
 */
export function isWeekendHeatmapActive(date = new Date()) {
  const day = date.getDay();
  return day === 0 || day === 5 || day === 6;
}

/**
 * Track player position for weekend heatmap (Fri-Sun only)
 * @param {string} name - Player name
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 */
export function addWeekendHeatPoint(name, x, y) {
  if (!isWeekendHeatmapActive()) return;

  const wh = loadWeekendHeat();
  const ts = Date.now();

  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  if (x < 0 || x > MAP_SIZE || y < 0 || y > MAP_SIZE) return;

  const point = {
    name,
    x: clamp(x, 0, MAP_SIZE),
    y: clamp(y, 0, MAP_SIZE),
    ts,
  };

  // Keep exactly one position per player.
  wh.points = wh.points.filter((p) => p.name !== name);
  wh.points.push(point);

  saveWeekendHeat(wh);
}

function pruneWeekendHeat(wh) {
  const minTs = Date.now() - WEEKEND_HEATMAP_WINDOW_MIN * 60 * 1000;
  const latestByPlayer = new Map();

  for (const point of wh.points) {
    if (point.ts < minTs) continue;

    const previous = latestByPlayer.get(point.name);
    if (!previous || point.ts > previous.ts) {
      latestByPlayer.set(point.name, point);
    }
  }

  wh.points = Array.from(latestByPlayer.values());
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
    console.warn("[weekend-heatmap] Could not read base map, using transparent canvas:", e.message);
  }

  // Build clusters
  const clusters = buildHeatClusters(points);

  // Create transparent overlay
  const overlay = new PNG({ width: W, height: H });
  overlay.data.fill(0);

  // Identify 5+ clusters for bridge connections
  const fivePlusClusters = clusters.filter((c) => c.count >= 5);
  const bridgeConnections = [];

  for (let i = 0; i < fivePlusClusters.length; i++) {
    for (let j = i + 1; j < fivePlusClusters.length; j++) {
      const c1 = fivePlusClusters[i];
      const c2 = fivePlusClusters[j];

      const dx = c2.x - c1.x;
      const dy = c2.y - c1.y;
      const worldDist = Math.sqrt(dx * dx + dy * dy);

      if (worldDist >= 125 && worldDist <= 300) {
        bridgeConnections.push({ c1, c2, worldDist });
      }
    }
  }

  // Draw heat bridges before cluster dots
  for (const { c1, c2 } of bridgeConnections) {
    const p1 = mapToPixelCoords(c1.x, c1.y, W, H);
    const p2 = mapToPixelCoords(c2.x, c2.y, W, H);

    drawSoftBridge(overlay, p1.px, p1.py, p2.px, p2.py, 28, 59, 130, 246, 95, W, H);
    drawSoftBridge(overlay, p1.px, p1.py, p2.px, p2.py, 18, 34, 197, 94, 90, W, H);
    drawSoftBridge(overlay, p1.px, p1.py, p2.px, p2.py, 9, 234, 179, 8, 70, W, H);
  }

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
export async function maybeSendWeekendHeatmap(client) {
  if (!WEEKEND_HEATMAP_CHANNEL_ID) return;

  // Only send/update on Friday, Saturday, Sunday
  if (!isWeekendHeatmapActive()) {
    return;
  }

  const now = Date.now();
  const wh = loadWeekendHeat();

  const previousPoints = JSON.stringify(wh.points);
  pruneWeekendHeat(wh);
  const pointsChanged = JSON.stringify(wh.points) !== previousPoints;

  if (pointsChanged) {
    saveWeekendHeat(wh);
  }

  // Scheduling is controlled by the shared heatmap timer in index.js.

  // Prevent concurrent sends
  if (weekendHeatmapSending) return;
  weekendHeatmapSending = true;

  try {
    const ch = await client.channels.fetch(WEEKEND_HEATMAP_CHANNEL_ID).catch(() => null);
    if (!ch || typeof ch.send !== "function") {
      console.warn("[weekend-heatmap] Invalid channel");
      return;
    }

    const updatedTimestamp = Math.floor(now / 1000);
    const embed = new EmbedBuilder()
      .setTitle("📍 Players Location Heatmap 📍")
      .setColor(0x00ae86)
      .setFooter({ text: `Bellok's Killfeed • ${MAP_DISPLAY_NAME}` })
      .setTimestamp(now);

    let payload;

    if (wh.points.length) {
      renderWeekendHeatPng(wh.points, WEEKEND_HEATMAP_IMG_PATH, MAP_IMAGE_PATH);
      await new Promise((r) => setTimeout(r, 80));

      const file = new AttachmentBuilder(WEEKEND_HEATMAP_IMG_PATH);

      embed
        .setDescription(
          `• **Updated:** <t:${updatedTimestamp}:R>\n` + `• **Players:** ${wh.points.length}`
        )
        .setImage(`attachment://${WEEKEND_HEATMAP_IMG_PATH.split("/").pop()}`);

      payload = { content: "", embeds: [embed], files: [file] };
    } else {
      embed.setDescription(
        `No player locations recorded in the last ${WEEKEND_HEATMAP_WINDOW_MIN} minutes.`
      );

      payload = {
        content: "",
        embeds: [embed],
        files: [],
        attachments: [],
      };
    }

    // Try to edit existing message, or send new one
    let sent = false;
    if (wh.messageId) {
      try {
        const existingMsg = await ch.messages.fetch(wh.messageId).catch(() => null);
        if (existingMsg) {
          await existingMsg.edit(payload);
          sent = true;
          console.log("[weekend-heatmap] Edited existing message", wh.messageId);
        } else {
          console.log("[weekend-heatmap] Previous message not found, sending new one");
          wh.messageId = null;
        }
      } catch (e) {
        console.warn(
          "[weekend-heatmap] Failed to edit message, sending new one:",
          e?.code || e?.message
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
  } finally {
    weekendHeatmapSending = false;
  }
}
