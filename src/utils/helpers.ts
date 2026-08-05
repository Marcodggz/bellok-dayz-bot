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

export function looksLikeHtml(value: unknown): boolean {
  const text = value ? String(value) : "";

  return /^\s*<!DOCTYPE html>|^\s*<html/i.test(text);
}

export function looksLikeRateLimit(value: unknown): boolean {
  const text = value ? String(value) : "";

  return /rate\s*limit/i.test(text);
}

export function tMadrid(ms: number): string {
  return new Date(ms).toLocaleString("es-ES", {
    timeZone: "Europe/Madrid",
  });
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
