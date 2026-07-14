// src/utils/heatmapRenderer.js — Shared heatmap rendering utilities

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

module.exports = {
  buildHeatClusters,
};
