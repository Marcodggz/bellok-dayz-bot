// src/utils/helpers.ts — Pure utility functions

/**
 * Convert buffer/object/string to text safely
 */
export function bufToText(value: unknown): string {
  try {
    if (!value) return "";
    if (Buffer.isBuffer(value)) return value.toString("utf8");
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  } catch {
    return String(value);
  }
}

/**
 * Check if text looks like HTML response
 */
export function looksLikeHtml(value: unknown): boolean {
  const text = value ? String(value) : "";

  return /^\s*<!DOCTYPE html>|^\s*<html/i.test(text);
}

/**
 * Check if text mentions rate limit
 */
export function looksLikeRateLimit(value: unknown): boolean {
  const text = value ? String(value) : "";

  return /rate\s*limit/i.test(text);
}

/**
 * Format timestamp to Madrid timezone
 */
export function tMadrid(ms: number): string {
  return new Date(ms).toLocaleString("es-ES", {
    timeZone: "Europe/Madrid",
  });
}

/**
 * Clamp value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Escape special regex characters
 */
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
