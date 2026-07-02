// src/utils/helpers.js — Pure utility functions

/**
 * Convert buffer/object/string to text safely
 */
function bufToText(x) {
  try {
    if (!x) return '';
    if (Buffer.isBuffer(x)) return x.toString('utf8');
    if (typeof x === 'object') return JSON.stringify(x);
    return String(x);
  } catch {
    return String(x);
  }
}

/**
 * Check if text looks like HTML response
 */
function looksLikeHtml(txt) {
  return /^\s*<!DOCTYPE html>|^\s*<html/i.test(txt || '');
}

/**
 * Check if text mentions rate limit
 */
function looksLikeRateLimit(txt) {
  return /rate\s*limit/i.test(txt || '');
}

/**
 * Format timestamp to Madrid timezone
 */
function tMadrid(ms) {
  return new Date(ms).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' });
}

/**
 * Clamp value between min and max
 */
function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

/**
 * Escape special regex characters
 */
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  bufToText,
  looksLikeHtml,
  looksLikeRateLimit,
  tMadrid,
  clamp,
  escapeRegExp,
};
