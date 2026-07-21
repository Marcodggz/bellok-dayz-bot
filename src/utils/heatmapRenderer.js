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
function lerp(start, end, amount) {
  return start + (end - start) * amount;
}

function smoothstep(amount) {
  const t = Math.max(0, Math.min(1, amount));
  return t * t * (3 - 2 * t);
}

function sampleHeatGradient(stops, distance) {
  const normalizedDistance = Math.max(0, Math.min(1, distance));

  for (let i = 0; i < stops.length - 1; i++) {
    const current = stops[i];
    const next = stops[i + 1];

    if (normalizedDistance <= next.position) {
      const range = next.position - current.position;
      const rawAmount =
        range === 0
          ? 0
          : (normalizedDistance - current.position) / range;
      const amount = smoothstep(rawAmount);

      return {
        r: Math.round(lerp(current.r, next.r, amount)),
        g: Math.round(lerp(current.g, next.g, amount)),
        b: Math.round(lerp(current.b, next.b, amount)),
        alpha: Math.round(lerp(current.alpha, next.alpha, amount)),
      };
    }
  }

  return stops[stops.length - 1];
}

const HEAT_GRADIENTS = {
  1: [
    { position: 0, r: 72, g: 145, b: 255, alpha: 210 },
    { position: 0.35, r: 45, g: 112, b: 255, alpha: 180 },
    { position: 0.7, r: 28, g: 72, b: 225, alpha: 105 },
    { position: 1, r: 18, g: 42, b: 150, alpha: 0 },
  ],
  2: [
    { position: 0, r: 74, g: 222, b: 210, alpha: 215 },
    { position: 0.35, r: 48, g: 187, b: 221, alpha: 185 },
    { position: 0.7, r: 39, g: 118, b: 240, alpha: 110 },
    { position: 1, r: 22, g: 55, b: 170, alpha: 0 },
  ],
  3: [
    { position: 0, r: 245, g: 196, b: 66, alpha: 225 },
    { position: 0.3, r: 93, g: 214, b: 126, alpha: 200 },
    { position: 0.67, r: 45, g: 144, b: 226, alpha: 120 },
    { position: 1, r: 24, g: 58, b: 170, alpha: 0 },
  ],
  4: [
    { position: 0, r: 249, g: 115, b: 22, alpha: 235 },
    { position: 0.3, r: 239, g: 180, b: 35, alpha: 210 },
    { position: 0.58, r: 67, g: 199, b: 108, alpha: 165 },
    { position: 0.8, r: 43, g: 126, b: 230, alpha: 90 },
    { position: 1, r: 25, g: 57, b: 165, alpha: 0 },
  ],
  5: [
    { position: 0, r: 239, g: 68, b: 68, alpha: 245 },
    { position: 0.24, r: 249, g: 115, b: 22, alpha: 225 },
    { position: 0.48, r: 234, g: 179, b: 8, alpha: 195 },
    { position: 0.68, r: 49, g: 195, b: 102, alpha: 145 },
    { position: 0.84, r: 43, g: 119, b: 225, alpha: 80 },
    { position: 1, r: 24, g: 54, b: 160, alpha: 0 },
  ],
};

/**
 * Draw a continuous radial heat gradient for one cluster.
 */
function drawHeatCluster(overlay, pixelX, pixelY, visualCount, width, height) {
  const radii = {
    1: 16,
    2: 18,
    3: 21,
    4: 24,
    5: 28,
  };

  const normalizedCount = Math.max(1, Math.min(5, visualCount));
  const maxRadius = radii[normalizedCount];
  const gradient = HEAT_GRADIENTS[normalizedCount];

  for (let dy = -maxRadius; dy <= maxRadius; dy++) {
    for (let dx = -maxRadius; dx <= maxRadius; dx++) {
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > maxRadius) continue;

      const x = pixelX + dx;
      const y = pixelY + dy;

      if (x < 0 || x >= width || y < 0 || y >= height) continue;

      const normalizedDistance = distance / maxRadius;
      const { r, g, b, alpha } = sampleHeatGradient(
        gradient,
        normalizedDistance,
      );

      if (alpha <= 0) continue;

      const offset = (y * width + x) * 4;

      if (overlay.data[offset + 3] < alpha) {
        overlay.data[offset + 0] = r;
        overlay.data[offset + 1] = g;
        overlay.data[offset + 2] = b;
        overlay.data[offset + 3] = alpha;
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

/**
 * Draw soft heat bridge between two points using distance-to-line-segment
 * @param {PNG} png - PNG overlay to draw on
 * @param {number} x1 - Start X in pixels
 * @param {number} y1 - Start Y in pixels
 * @param {number} x2 - End X in pixels
 * @param {number} y2 - End Y in pixels
 * @param {number} radius - Bridge radius in pixels
 * @param {number} r - Red value (0-255)
 * @param {number} g - Green value (0-255)
 * @param {number} b - Blue value (0-255)
 * @param {number} maxAlpha - Maximum alpha value (0-255)
 * @param {number} W - Canvas width
 * @param {number} H - Canvas height
 */
function drawSoftBridge(png, x1, y1, x2, y2, radius, r, g, b, maxAlpha, W, H) {
  const minX = Math.max(0, Math.min(x1, x2) - radius - 1);
  const maxX = Math.min(W - 1, Math.max(x1, x2) + radius + 1);
  const minY = Math.max(0, Math.min(y1, y2) - radius - 1);
  const maxY = Math.min(H - 1, Math.max(y1, y2) + radius + 1);

  const dx = x2 - x1;
  const dy = y2 - y1;
  const segmentLengthSq = dx * dx + dy * dy;

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      let distance;

      if (segmentLengthSq === 0) {
        distance = Math.sqrt((x - x1) ** 2 + (y - y1) ** 2);
      } else {
        const t = Math.max(
          0,
          Math.min(1, ((x - x1) * dx + (y - y1) * dy) / segmentLengthSq),
        );
        const projX = x1 + t * dx;
        const projY = y1 + t * dy;
        distance = Math.sqrt((x - projX) ** 2 + (y - projY) ** 2);
      }

      if (distance <= radius) {
        const falloff = 1 - distance / radius;
        const alpha = Math.round(maxAlpha * Math.pow(falloff, 1.5));

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

module.exports = {
  buildHeatClusters,
  drawHeatCluster,
  composeHeatmapOverlay,
  drawSoftBridge,
};
