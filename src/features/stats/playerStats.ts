import type { KillEvent, PlayerRank, PlayerStats } from "../../types/domainEvents.js";
import type {
  PersistedPlayerStats,
  PersistedPlayerStatsCollection,
} from "../../types/domainPersistence.js";

type MutableStatsCollection = PersistedPlayerStatsCollection;

export function createEmptyStats(): MutableStatsCollection {
  return {};
}

function ensurePlayerStats(stats: MutableStatsCollection, playerName: string): PlayerStats {
  const persistedStats = stats[playerName] ?? {};

  const playerStats: PlayerStats = {
    kills: persistedStats.kills ?? 0,
    deaths: persistedStats.deaths ?? 0,
    headshots: persistedStats.headshots ?? 0,
    kd: persistedStats.kd ?? 0,
    killStreak: persistedStats.killStreak ?? 0,
    bestKillStreak: persistedStats.bestKillStreak ?? persistedStats.killStreak ?? 0,
    deathStreak: persistedStats.deathStreak ?? 0,
    worstDeathStreak: persistedStats.worstDeathStreak ?? persistedStats.deathStreak ?? 0,
    lastKill: persistedStats.lastKill ?? null,
    lastDeath: persistedStats.lastDeath ?? null,
    weaponKills: persistedStats.weaponKills ?? {},
    favouriteWeapon: persistedStats.favouriteWeapon ?? null,
    score: persistedStats.score ?? 0,
    rank: persistedStats.rank ?? "Private",
    longestKill: persistedStats.longestKill ?? 0,
    longestKillWeapon: persistedStats.longestKillWeapon ?? null,
    connectedSince: persistedStats.connectedSince ?? null,
    accumulatedAliveMs: persistedStats.accumulatedAliveMs ?? 0,
    isConnected: persistedStats.isConnected ?? false,
    isAlive: persistedStats.isAlive ?? true,
    lastTimeAlive: persistedStats.lastTimeAlive ?? null,
    bestTimeAliveMs: persistedStats.bestTimeAliveMs ?? 0,
    accumulatedPlayedMs: persistedStats.accumulatedPlayedMs ?? 0,
  };

  stats[playerName] = playerStats;

  return playerStats;
}

function finishPlayerLife(
  stats: MutableStatsCollection,
  victimName: string,
  normalizedEventTimeMs: number | null
): PlayerStats | null {
  const victimStats = ensurePlayerStats(stats, victimName);

  if (!victimStats.isAlive) {
    return null;
  }

  let totalAliveMs = victimStats.accumulatedAliveMs;

  if (
    victimStats.isConnected &&
    victimStats.connectedSince !== null &&
    normalizedEventTimeMs !== null
  ) {
    const sessionMs = Math.max(0, normalizedEventTimeMs - victimStats.connectedSince);

    totalAliveMs += sessionMs;
    victimStats.accumulatedPlayedMs += sessionMs;
  }

  victimStats.lastTimeAlive = formatTimeAlive(totalAliveMs);
  victimStats.bestTimeAliveMs = Math.max(victimStats.bestTimeAliveMs, totalAliveMs);
  victimStats.accumulatedAliveMs = 0;
  victimStats.connectedSince = null;
  victimStats.isConnected = false;
  victimStats.isAlive = false;
  victimStats.killStreak = 0;

  return victimStats;
}

function applyCompetitiveDeathStats(victimStats: PlayerStats): void {
  victimStats.deaths++;
  victimStats.deathStreak++;
  victimStats.worstDeathStreak = Math.max(victimStats.worstDeathStreak, victimStats.deathStreak);
  victimStats.kd = calculateKD(victimStats.kills, victimStats.deaths);
  victimStats.score = calculateScore(victimStats);
  victimStats.rank = calculateRank(victimStats.score);
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
      killerStats.bestKillStreak = Math.max(killerStats.bestKillStreak, killerStats.killStreak);
      killerStats.deathStreak = 0;

      if (event.victim) {
        killerStats.lastKill = event.victim;
      }

      const weapon = event.weapon || "Unknown";
      killerStats.weaponKills[weapon] = (killerStats.weaponKills[weapon] ?? 0) + 1;

      const favouriteWeaponKills = killerStats.favouriteWeapon
        ? (killerStats.weaponKills[killerStats.favouriteWeapon] ?? 0)
        : 0;

      if (!killerStats.favouriteWeapon || killerStats.weaponKills[weapon] > favouriteWeaponKills) {
        killerStats.favouriteWeapon = weapon;
      }

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
      const victimStats = finishPlayerLife(stats, event.victim, normalizedEventTimeMs);

      if (victimStats) {
        if (event.killer) {
          victimStats.lastDeath = event.killer;
        }

        applyCompetitiveDeathStats(victimStats);
      }
    }

    return;
  }

  if (event.type === "explosion" && event.victim) {
    const victimStats = finishPlayerLife(stats, event.victim, normalizedEventTimeMs);

    if (victimStats) {
      applyCompetitiveDeathStats(victimStats);
    }
  }
}

export function applyNonPvpDeath(
  stats: MutableStatsCollection,
  victimName: string,
  normalizedEventTimeMs: number | null = null
): void {
  finishPlayerLife(stats, victimName, normalizedEventTimeMs);
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

export function resetStalePlayerSessions(stats: MutableStatsCollection): boolean {
  let changed = false;

  for (const playerStats of Object.values(stats)) {
    if (playerStats.isConnected || playerStats.connectedSince !== null) {
      playerStats.isConnected = false;
      playerStats.connectedSince = null;
      changed = true;
    }
  }

  return changed;
}

export function handlePlayerConnect(
  stats: MutableStatsCollection,
  playerName: string,
  normalizedConnectTimeMs: number | null
): void {
  const playerStats = ensurePlayerStats(stats, playerName);

  if (normalizedConnectTimeMs !== null) {
    if (!playerStats.isAlive) {
      playerStats.accumulatedAliveMs = 0;
      playerStats.isAlive = true;
    }

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
    playerStats.isAlive &&
    playerStats.isConnected &&
    playerStats.connectedSince !== null &&
    normalizedDisconnectTimeMs !== null
  ) {
    const sessionMs = Math.max(0, normalizedDisconnectTimeMs - playerStats.connectedSince);

    playerStats.accumulatedAliveMs += sessionMs;
    playerStats.accumulatedPlayedMs += sessionMs;
  }

  playerStats.isConnected = false;
  playerStats.connectedSince = null;
}
