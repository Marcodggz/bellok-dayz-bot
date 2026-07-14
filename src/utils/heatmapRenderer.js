// src/utils/heatmapRenderer.js — Shared heatmap rendering utilities

const { PNG } = require("pngjs");

/**
 * Build spatial clusters from point array using proximity merging
 * @param {Array} points - Array of {x, y} world coordinates
 * @returns {Array} Array of {x, y, count} clusters
 */
function buildHeatClusters(points) {
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
 * Draw radial heat gradient for a single cluster
 * @param {PNG} overlay - PNG overlay object to draw on
 * @param {number} pixelX - Center X coordinate in pixels
 * @param {number} pixelY - Center Y coordinate in pixels
 * @param {number} visualCount - Cluster count (1-5)
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 */
function drawHeatCluster(overlay, pixelX, pixelY, visualCount, width, height) {
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
    coreRadius = 12;
    outerRadius = 28;
  }

  const maxRadius = outerRadius;

  for (let dy = -maxRadius; dy <= maxRadius; dy++) {
    for (let dx = -maxRadius; dx <= maxRadius; dx++) {
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > maxRadius) continue;

      const x = pixelX + dx;
      const y = pixelY + dy;
      if (x < 0 || x >= width || y < 0 || y >= height) continue;

      const normDist = dist / maxRadius;
      const falloff = Math.pow(1 - normDist, 1.6);
      const coreRatio = coreRadius / maxRadius;
      let r, g, b, alpha;

      if (visualCount === 1) {
        if (normDist > 0.5) {
          r = 59;
          g = 130;
          b = 246;
          alpha = Math.round(100 + falloff * 30);
        } else if (normDist > coreRatio) {
          r = 59;
          g = 130;
          b = 246;
          alpha = Math.round(120 + falloff * 40);
        } else {
          r = 34;
          g = 197;
          b = 94;
          alpha = Math.round(145 + falloff * 30);
        }
      } else if (visualCount === 2) {
        if (normDist > 0.55) {
          r = 59;
          g = 130;
          b = 246;
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
          b = 128;
          alpha = Math.round(150 + falloff * 30);
        }
      } else if (visualCount === 3) {
        if (normDist > 0.6) {
          r = 59;
          g = 130;
          b = 246;
          alpha = Math.round(90 + falloff * 30);
        } else if (normDist > coreRatio * 1.5) {
          r = 34;
          g = 197;
          b = 94;
          alpha = Math.round(135 + falloff * 40);
        } else if (normDist > coreRatio) {
          r = 234;
          g = 179;
          b = 8;
          alpha = Math.round(165 + falloff * 35);
        } else {
          r = 251;
          g = 146;
          b = 60;
          alpha = Math.round(190 + falloff * 30);
        }
      } else if (visualCount === 4) {
        if (normDist > 0.62) {
          r = 59;
          g = 130;
          b = 246;
          alpha = Math.round(95 + falloff * 30);
        } else if (normDist > coreRatio * 1.6) {
          r = 34;
          g = 197;
          b = 94;
          alpha = Math.round(145 + falloff * 40);
        } else if (normDist > coreRatio * 1.1) {
          r = 234;
          g = 179;
          b = 8;
          alpha = Math.round(175 + falloff * 30);
        } else {
          r = 249;
          g = 115;
          b = 22;
          alpha = Math.round(200 + falloff * 25);
        }
      } else {
        if (normDist > 0.65) {
          r = 59;
          g = 130;
          b = 246;
          alpha = Math.round(100 + falloff * 30);
        } else if (normDist > coreRatio * 1.7) {
          r = 34;
          g = 197;
          b = 94;
          alpha = Math.round(155 + falloff * 40);
        } else if (normDist > coreRatio * 1.2) {
          r = 234;
          g = 179;
          b = 8;
          alpha = Math.round(180 + falloff * 30);
        } else if (normDist > coreRatio * 0.6) {
          r = 249;
          g = 115;
          b = 22;
          alpha = Math.round(205 + falloff * 25);
        } else {
          r = 239;
          g = 68;
          b = 68;
          alpha = Math.round(215 + falloff * 15);
        }
      }

      const o = (y * width + x) * 4;
      if (overlay.data[o + 3] < alpha) {
        overlay.data[o + 0] = r;
        overlay.data[o + 1] = g;
        overlay.data[o + 2] = b;
        overlay.data[o + 3] = alpha;
      }
    }
  }
}

/**
 * Compose overlay onto base map using alpha blending
 * @param {PNG|null} basePng - Base map PNG or null
 * @param {PNG} overlay - Heat overlay PNG
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @returns {PNG} Composed PNG (or overlay if no base map)
 */
function composeHeatmapOverlay(basePng, overlay, width, height) {
  if (!basePng) {
    return overlay;
  }

  const outPng = new PNG({ width, height });
  for (let i = 0; i < width * height; i++) {
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
  return outPng;
}

module.exports = {
  buildHeatClusters,
  drawHeatCluster,
  composeHeatmapOverlay,
};
