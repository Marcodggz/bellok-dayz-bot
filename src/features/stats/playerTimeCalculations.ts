import type { PersistedPlayerStats } from "../../types/domainPersistence.js";

export function calculateCurrentTimePlayedMs(
  stats: PersistedPlayerStats,
  estimatedAdmTimeMs: number | null
): number {
  let totalPlayedMs = stats.accumulatedPlayedMs ?? 0;

  if (
    stats.isConnected === true &&
    stats.connectedSince !== null &&
    stats.connectedSince !== undefined &&
    estimatedAdmTimeMs !== null
  ) {
    totalPlayedMs += Math.max(0, estimatedAdmTimeMs - stats.connectedSince);
  }

  return totalPlayedMs;
}

export function calculateCurrentTimeAliveMs(
  stats: PersistedPlayerStats,
  estimatedAdmTimeMs: number | null
): number | null {
  if (stats.isAlive === false) {
    return null;
  }

  let totalAliveMs = stats.accumulatedAliveMs ?? 0;

  if (
    stats.isConnected === true &&
    stats.connectedSince !== null &&
    stats.connectedSince !== undefined &&
    estimatedAdmTimeMs !== null
  ) {
    totalAliveMs += Math.max(0, estimatedAdmTimeMs - stats.connectedSince);
  }

  return totalAliveMs;
}
