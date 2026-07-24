// src/utils/coordinateMapper.ts — World-to-pixel coordinate mapping

import { clamp } from "./helpers.js";
import {
  MAP_MIN_X,
  MAP_MAX_X,
  MAP_MIN_Y,
  MAP_MAX_Y,
  MAP_FLIP_Y,
  MAP_OFFSET_X,
  MAP_OFFSET_Y,
  MAP_SCALE_X,
  MAP_SCALE_Y,
} from "../config/config.js";

export function mapToPixelCoords(x, y, W, H, debug = false) {
  // Normalize world coordinates with optional cropping/offset/scale
  const nx = (x - MAP_MIN_X) / Math.max(1, MAP_MAX_X - MAP_MIN_X);
  const ny = (y - MAP_MIN_Y) / Math.max(1, MAP_MAX_Y - MAP_MIN_Y);
  const sx = nx * MAP_SCALE_X + MAP_OFFSET_X;
  const sy = ny * MAP_SCALE_Y + MAP_OFFSET_Y;

  // Letterbox: center square within image dimensions
  const side = Math.min(W, H);
  const offX = (W - side) / 2;
  const offY = (H - side) / 2;

  // Pixel insets to crop inner map border
  const INSET_L = Number(process.env.MAP_PIX_INSET_L || 0);
  const INSET_R = Number(process.env.MAP_PIX_INSET_R || 0);
  const INSET_T = Number(process.env.MAP_PIX_INSET_T || 0);
  const INSET_B = Number(process.env.MAP_PIX_INSET_B || 0);

  const innerW = Math.max(1, side - INSET_L - INSET_R);
  const innerH = Math.max(1, side - INSET_T - INSET_B);

  // Project to normalized UV (0..1), optional vertical flip
  const u = clamp(sx, 0, 1);
  const v = clamp(MAP_FLIP_Y ? 1 - sy : sy, 0, 1);

  // Final pixel coordinates within centered square + insets
  const px = Math.floor(offX + INSET_L + u * innerW);
  const py = Math.floor(offY + INSET_T + v * innerH);

  // Diagnostic logging when debug flag is set
  if (debug) {
    console.log(
      `[coord-map] Raw: (${x.toFixed(1)}, ${y.toFixed(1)}) → Normalized: (${nx.toFixed(3)}, ${ny.toFixed(3)}) → Scaled: (${sx.toFixed(3)}, ${sy.toFixed(3)}) → UV: (${u.toFixed(3)}, ${v.toFixed(3)}) → Pixel: (${px}, ${py})`
    );
  }

  return { px, py };
}
