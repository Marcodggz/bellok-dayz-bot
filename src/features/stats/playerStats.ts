// Player statistics tracking

import type { KillEvent, PlayerRank, PlayerStats } from "../../types/domainEvents";
import type {
  PersistedPlayerStats,
  PersistedPlayerStatsCollection,
} from "../../types/domainPersistence";

type MutableStatsCollection = PersistedPlayerStatsCollection;

export function createEmptyStats(): MutableStatsCollection {
  return {};
}

function ensurePlayerStats(stats: MutableStatsCollection, playerName: string): PlayerStats {
  if (!stats[playerName]) {
    stats[playerName] = {
      kills: 0,
      deaths: 0,
      headshots: 0,
      kd: 0,
      killStreak: 0,
      deathStreak: 0,
      score: 0,
      rank: "Private",
      longestKill: 0,
      longestKillWeapon: null,
      connectedSince: null,
      accumulatedAliveMs: 0,
      isConnected: false,
      lastTimeAlive: null,
      accumulatedPlayedMs: 0,
    };
  }

  const playerStats = stats[playerName] as PersistedPlayerStats;

  playerStats.kills ??= 0;
  playerStats.deaths ??= 0;
  playerStats.headshots ??= 0;
  playerStats.kd ??= 0;
  playerStats.killStreak ??= 0;
  playerStats.deathStreak ??= 0;
  playerStats.score ??= 0;
  playerStats.rank ??= "Private";
  playerStats.longestKill ??= 0;
  playerStats.longestKillWeapon ??= null;
  playerStats.connectedSince ??= null;
  playerStats.accumulatedAliveMs ??= 0;
  playerStats.isConnected ??= false;
  playerStats.lastTimeAlive ??= null;
  playerStats.accumulatedPlayedMs ??= 0;

  return playerStats as PlayerStats;
}

function applyVictimDeath(
  stats: MutableStatsCollection,
  victimName: string,
  normalizedEventTimeMs: number | null
): PlayerStats {
  const victimStats = ensurePlayerStats(stats, victimName);

  if (
    victimStats.isConnected &&
    victimStats.connectedSince !== null &&
    normalizedEventTimeMs !== null
  ) {
    const sessionMs = normalizedEventTimeMs - victimStats.connectedSince;
    const totalAliveMs = victimStats.accumulatedAliveMs + sessionMs;

    victimStats.lastTimeAlive = formatTimeAlive(totalAliveMs);
    victimStats.accumulatedPlayedMs += sessionMs;
    victimStats.accumulatedAliveMs = 0;
    victimStats.connectedSince = normalizedEventTimeMs;
  } else {
    victimStats.lastTimeAlive = "N/A";

    console.warn(
      `[mock-parse] WARNING: No connection info for victim ${victimName}. Time Alive set to N/A.`
    );
  }

  victimStats.deaths++;
  victimStats.deathStreak++;
  victimStats.killStreak = 0;
  victimStats.kd = calculateKD(victimStats.kills, victimStats.deaths);
  victimStats.score = calculateScore(victimStats);
  victimStats.rank = calculateRank(victimStats.score);

  return victimStats;
}

export function updateStatsFromEvent(
  stats: MutableStatsCollection,
  event: KillEvent | null | undefined,
  normalizedEventTimeMs: number | null = null
): void {
  if (!event?.type) {
    return;
  }

  if (event.type === "pvp") {
    if (event.killer) {
      const killerStats = ensurePlayerStats(stats, event.killer);

      killerStats.kills++;
      killerStats.killStreak++;
      killerStats.deathStreak = 0;

      if (event.hitZone === "Head") {
        killerStats.headshots++;
      }

      if (event.distanceMeters !== null && event.distanceMeters > killerStats.longestKill) {
        killerStats.longestKill = event.distanceMeters;
        killerStats.longestKillWeapon = event.weapon || "Unknown";
      }

      killerStats.kd = calculateKD(killerStats.kills, killerStats.deaths);
      killerStats.score = calculateScore(killerStats);
      killerStats.rank = calculateRank(killerStats.score);
    }

    if (event.victim) {
      applyVictimDeath(stats, event.victim, normalizedEventTimeMs);
    }

    return;
  }

  if (event.type === "explosion" && event.victim) {
    applyVictimDeath(stats, event.victim, normalizedEventTimeMs);
  }
}

export function getPlayerStats(
  stats: MutableStatsCollection | null | undefined,
  playerName: string | null | undefined
): PersistedPlayerStats | null {
  if (!stats || !playerName) {
    return null;
  }

  return stats[playerName] || null;
}

function calculateKD(kills: number, deaths: number): number {
  const kd = kills / Math.max(deaths, 1);
  const capped = Math.min(kd, 10);

  return Number(capped.toFixed(2));
}

function calculateScore(playerStats: PlayerStats): number {
  const { kills, headshots, killStreak, deaths, kd } = playerStats;

  const score =
    kills * 1.5 + Math.sqrt(kills) * 10 + headshots * 0.5 + killStreak * 4 + kd * 20 - deaths * 0.5;

  return Number(Math.max(0, score).toFixed(1));
}

function calculateRank(score: number): PlayerRank {
  if (score >= 800) {
    return "Specialist";
  }

  if (score >= 500) {
    return "Corporal";
  }

  if (score >= 250) {
    return "Lance Corporal";
  }

  if (score >= 100) {
    return "Private First Class";
  }

  return "Private";
}

function formatTimeAlive(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || ms < 0) {
    return "N/A";
  }

  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${String(days).padStart(2, "0")}D ${String(hours).padStart(2, "0")}H ${String(minutes).padStart(2, "0")}M ${String(seconds).padStart(2, "0")}S`;
  }

  return `${String(hours).padStart(2, "0")}H ${String(minutes).padStart(2, "0")}M ${String(seconds).padStart(2, "0")}S`;
}

export function handlePlayerConnect(
  stats: MutableStatsCollection,
  playerName: string,
  normalizedConnectTimeMs: number | null
): void {
  const playerStats = ensurePlayerStats(stats, playerName);

  if (normalizedConnectTimeMs !== null) {
    playerStats.isConnected = true;
    playerStats.connectedSince = normalizedConnectTimeMs;
  }
}

export function handlePlayerDisconnect(
  stats: MutableStatsCollection,
  playerName: string,
  normalizedDisconnectTimeMs: number | null
): void {
  const playerStats = ensurePlayerStats(stats, playerName);

  if (
    playerStats.isConnected &&
    playerStats.connectedSince !== null &&
    normalizedDisconnectTimeMs !== null
  ) {
    const sessionMs = normalizedDisconnectTimeMs - playerStats.connectedSince;

    playerStats.accumulatedAliveMs += sessionMs;
    playerStats.accumulatedPlayedMs += sessionMs;
  }

  playerStats.isConnected = false;
  playerStats.connectedSince = null;
}
