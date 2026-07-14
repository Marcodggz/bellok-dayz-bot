// src/utils/weekendHeatmapHelpers.js — Weekend Heatmap utilities

const { PNG } = require("pngjs");
const fs = require("fs");
const { clamp } = require("./helpers");
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
  MAP_MIN_X,
  MAP_MAX_X,
  MAP_MIN_Y,
  MAP_MAX_Y,
  MAP_FLIP_Y,
  MAP_OFFSET_X,
  MAP_OFFSET_Y,
  MAP_SCALE_X,
  MAP_SCALE_Y,
} = require("../config/config");
const { EmbedBuilder, AttachmentBuilder } = require("discord.js");

/**
 * Check if weekend heatmap is currently active
 * @param {Date} date - Date to check (defaults to now)
 * @returns {boolean} True if Friday, Saturday, or Sunday
 */
function isWeekendHeatmapActive(date = new Date()) {
  const day = date.getDay(); // 0 = Sunday, 5 = Friday, 6 = Saturday
  return day === 0 || day === 5 || day === 6;
}

/**
 * Add a player position point to weekend heatmap
 * @param {string} name - Player name
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 */
function addWeekendHeatPoint(name, x, y) {
  // Only store positions on Friday, Saturday, Sunday
  if (!isWeekendHeatmapActive()) {
    return; // Don't store positions outside weekend (prevents Monday-Thursday growth)
  }

  const wh = loadWeekendHeat();
  const ts = Date.now();

  // Validate coordinates
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  if (x < 0 || x > MAP_SIZE || y < 0 || y > MAP_SIZE) return;

  // Avoid duplicate positions for same player in short time window (5 seconds)
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

/**
 * Prune old points from weekend heatmap
 * @param {Object} wh - Weekend heatmap state
 */
function pruneWeekendHeat(wh) {
  const minTs = Date.now() - WEEKEND_HEATMAP_WINDOW_MIN * 60 * 1000;
  wh.points = wh.points.filter((p) => p.ts >= minTs);
}

/**
 * Map world coordinates to pixel coordinates (reuses PvP heatmap logic)
 * @param {number} x - World X coordinate
 * @param {number} y - World Y coordinate
 * @param {number} W - Image width
 * @param {number} H - Image height
 * @returns {Object} Pixel coordinates {px, py}
 */
function mapToPixelCoords(x, y, W, H) {
  const nx = (x - MAP_MIN_X) / Math.max(1, MAP_MAX_X - MAP_MIN_X);
  const ny = (y - MAP_MIN_Y) / Math.max(1, MAP_MAX_Y - MAP_MIN_Y);
  const sx = nx * MAP_SCALE_X + MAP_OFFSET_X;
  const sy = ny * MAP_SCALE_Y + MAP_OFFSET_Y;

  const side = Math.min(W, H);
  const offX = (W - side) / 2;
  const offY = (H - side) / 2;

  const INSET_L = Number(process.env.MAP_PIX_INSET_L || 0);
  const INSET_R = Number(process.env.MAP_PIX_INSET_R || 0);
  const INSET_T = Number(process.env.MAP_PIX_INSET_T || 0);
  const INSET_B = Number(process.env.MAP_PIX_INSET_B || 0);

  const innerW = Math.max(1, side - INSET_L - INSET_R);
  const innerH = Math.max(1, side - INSET_T - INSET_B);

  const u = clamp(sx, 0, 1);
  const v = clamp(MAP_FLIP_Y ? 1 - sy : sy, 0, 1);

  const px = Math.floor(offX + INSET_L + u * innerW);
  const py = Math.floor(offY + INSET_T + v * innerH);
  return { px, py };
}

/**
 * Build clusters for weekend heatmap (player positions)
 * @param {Array} points - Array of {name, x, y, ts} points
 * @returns {Array} Array of clusters with {x, y, count}
 */
function buildWeekendHeatClusters(points) {
  const MERGE_RADIUS_METERS = 125;
  const clusters = [];

  for (const p of points) {
    let merged = false;
    for (const c of clusters) {
      const dx = p.x - c.x;
      const dy = p.y - c.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= MERGE_RADIUS_METERS) {
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
  const clusters = buildWeekendHeatClusters(points);

  // Create transparent overlay
  const overlay = new PNG({ width: W, height: H });
  overlay.data.fill(0);

  // Draw all clusters as radial dots
  for (const cluster of clusters) {
    const { px, py } = mapToPixelCoords(cluster.x, cluster.y, W, H);

    // Visual count capped at 5 to match color scale
    const visualCount = Math.min(cluster.count, 5);

    // Radii based on visual count
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

    // Draw radial heat gradient
    for (let dy = -maxRadius; dy <= maxRadius; dy++) {
      for (let dx = -maxRadius; dx <= maxRadius; dx++) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > maxRadius) continue;

        const x = px + dx;
        const y = py + dy;
        if (x < 0 || x >= W || y < 0 || y >= H) continue;

        const normDist = dist / maxRadius;
        const falloff = Math.pow(1 - normDist, 1.6);
        const coreRatio = coreRadius / maxRadius;
        let r, g, b, alpha;

        if (visualCount === 1) {
          // 1 player: blue/green, no orange
          if (normDist > 0.5) {
            r = 59;
            g = 130;
            b = 246; // Blue outer
            alpha = Math.round(100 + falloff * 30);
          } else if (normDist > coreRatio) {
            r = 59;
            g = 130;
            b = 246; // Brighter blue inner
            alpha = Math.round(120 + falloff * 40);
          } else {
            r = 34;
            g = 197;
            b = 94; // Green center
            alpha = Math.round(145 + falloff * 30);
          }
        } else if (visualCount === 2) {
          // 2 players: blue + strong green, no orange
          if (normDist > 0.55) {
            r = 59;
            g = 130;
            b = 246; // Blue outer
            alpha = Math.round(85 + falloff * 30);
          } else if (normDist > coreRatio * 1.2) {
            const t = (normDist - coreRatio * 1.2) / (0.55 - coreRatio * 1.2);
            r = Math.round(59 + (34 - 59) * (1 - t));
            g = Math.round(130 + (197 - 130) * (1 - t));
            b = Math.round(246 + (94 - 246) * (1 - t));
            alpha = Math.round(120 + falloff * 40);
          } else {
            r = 74;
            g = 222;
            b = 128; // Bright green center
            alpha = Math.round(150 + falloff * 30);
          }
        } else if (visualCount === 3) {
          // 3 players: starts orange
          if (normDist > 0.6) {
            r = 59;
            g = 130;
            b = 246; // Blue outer
            alpha = Math.round(90 + falloff * 30);
          } else if (normDist > coreRatio * 1.5) {
            r = 34;
            g = 197;
            b = 94; // Green mid
            alpha = Math.round(135 + falloff * 40);
          } else if (normDist > coreRatio) {
            r = 234;
            g = 179;
            b = 8; // Yellow transition
            alpha = Math.round(165 + falloff * 35);
          } else {
            r = 251;
            g = 146;
            b = 60; // Orange center
            alpha = Math.round(190 + falloff * 30);
          }
        } else if (visualCount === 4) {
          // 4 players: more orange
          if (normDist > 0.62) {
            r = 59;
            g = 130;
            b = 246; // Blue outer
            alpha = Math.round(95 + falloff * 30);
          } else if (normDist > coreRatio * 1.6) {
            r = 34;
            g = 197;
            b = 94; // Green mid
            alpha = Math.round(145 + falloff * 40);
          } else if (normDist > coreRatio * 1.1) {
            r = 234;
            g = 179;
            b = 8; // Yellow
            alpha = Math.round(175 + falloff * 30);
          } else {
            r = 249;
            g = 115;
            b = 22; // Bright orange center
            alpha = Math.round(200 + falloff * 25);
          }
        } else {
          // 5+ players: strongest orange/red
          if (normDist > 0.65) {
            r = 59;
            g = 130;
            b = 246; // Blue outer
            alpha = Math.round(100 + falloff * 30);
          } else if (normDist > coreRatio * 1.7) {
            r = 34;
            g = 197;
            b = 94; // Green mid
            alpha = Math.round(155 + falloff * 40);
          } else if (normDist > coreRatio * 1.2) {
            r = 234;
            g = 179;
            b = 8; // Yellow
            alpha = Math.round(180 + falloff * 30);
          } else if (normDist > coreRatio * 0.6) {
            r = 249;
            g = 115;
            b = 22; // Orange
            alpha = Math.round(205 + falloff * 25);
          } else {
            r = 239;
            g = 68;
            b = 68; // Red center
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

  // Compose onto base map
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
