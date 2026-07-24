// Killfeed Discord embed builders
// ADM pos=<X, Y, Z>: X/Y are map coordinates; Z is elevation.

import { EmbedBuilder } from "discord.js";
import { IZURVIVE_MAP_SLUG } from "../../config/config";
import type {
  ExplosionKillEvent,
  KillEvent,
  Position3D,
  PvPKillEvent,
} from "../../types/domainEvents";
import type { PersistedPlayerStats } from "../../types/domainPersistence";

interface NormalizedStats {
  rank: string;
  score: number;
  kills: number;
  deaths: number;
  kd: number;
  killStreak: number;
  lastTimeAlive: string;
}

export interface KillEmbedPayload {
  embeds: EmbedBuilder[];
}

export function buildIzurviveLocationUrl(x: number, y: number, zoom: number = 8): string {
  return `https://www.izurvive.com/${IZURVIVE_MAP_SLUG}/#location=${x};${y};${zoom}`;
}

export function sanitizePlayerName(name: string | null | undefined): string {
  return String(name || "Unknown").replace(/`/g, "'");
}

export function buildLocationLine(position: Position3D | null | undefined): string {
  if (position && position.x && position.y && position.z) {
    const { x, y, z } = position;
    const coordsText = `${x.toFixed(1)};${y.toFixed(1)};${z.toFixed(1)}`;
    const url = buildIzurviveLocationUrl(x, y);

    return `**Location** [${coordsText}](${url})`;
  }

  return "**Location** N/A";
}

function normalizeStats(stats: PersistedPlayerStats | null | undefined): NormalizedStats {
  if (!stats) {
    return {
      rank: "Unranked",
      score: 0,
      kills: 0,
      deaths: 0,
      kd: 0,
      killStreak: 0,
      lastTimeAlive: "0m",
    };
  }

  return {
    rank: stats.rank || "Unranked",
    score: stats.score ?? 0,
    kills: stats.kills ?? 0,
    deaths: stats.deaths ?? 0,
    kd: stats.kd ?? 0,
    killStreak: stats.killStreak ?? 0,
    lastTimeAlive: stats.lastTimeAlive || "0m",
  };
}

export function buildVictimStatsLines(
  victimName: string,
  stats: PersistedPlayerStats | null | undefined
): string[] {
  const normalizedStats = normalizeStats(stats);

  return [
    `__**Victim:**__ \`${victimName}\``,
    `**Rank:** ${normalizedStats.rank} | **Score:** ${normalizedStats.score.toFixed(1)}`,
    `**Kills:** ${normalizedStats.kills} | **Deaths:** ${normalizedStats.deaths} | **KD:** ${normalizedStats.kd.toFixed(2)}`,
    `**Time Alive:** ${normalizedStats.lastTimeAlive}`,
  ];
}

export function getRandomPvpAction(
  killer: string | null | undefined,
  victim: string | null | undefined
): string {
  const actions = ["embarrassed", "eliminated", "shit on"];
  const seed = (killer || "").length + (victim || "").length * 3;
  const index = seed % actions.length;

  return actions[index];
}

export function embedPvp(
  {
    killer,
    victim,
    weapon,
    distanceMeters,
    ammo,
    hitZone,
    damage,
    victimPosition,
    t,
  }: PvPKillEvent,
  eventTimestamp: number | null = null,
  killerStats: PersistedPlayerStats | null = null,
  victimStats: PersistedPlayerStats | null = null
): KillEmbedPayload {
  const lines: string[] = [];

  lines.push("**⚔️ Killfeed Notification ⚔️**");

  const timeDisplay = eventTimestamp
    ? `<t:${Math.floor(eventTimestamp / 1000)}:T>`
    : t || "Unknown time";

  lines.push(`### PVP Kill - ${timeDisplay}`);
  lines.push("");

  const killerName = sanitizePlayerName(killer);
  const victimName = sanitizePlayerName(victim);
  const action = getRandomPvpAction(killerName, victimName);

  lines.push(`\`${killerName}\` ${action} \`${victimName}\``);

  const weaponText = weapon || "N/A";
  const ammoText = ammo ? ` (${ammo})` : "";

  lines.push(`**Weapon** ${weaponText}${ammoText}`);

  const distanceText =
    distanceMeters !== null && distanceMeters !== undefined ? distanceMeters.toFixed(0) : "0";

  lines.push(`**Distance** ${distanceText} meters`);

  const hitZoneText = hitZone || "N/A";
  const damageText = damage !== null && damage !== undefined ? damage.toFixed(0) : "N/A";

  lines.push(`**Hit** ${hitZoneText} ${damageText} damage`);
  lines.push(buildLocationLine(victimPosition));
  lines.push("");

  const normalizedKillerStats = normalizeStats(killerStats);

  lines.push(`__**Killer:**__ \`${killerName}\``);
  lines.push(
    `**Rank:** ${normalizedKillerStats.rank} | **Score:** ${normalizedKillerStats.score.toFixed(1)}`
  );
  lines.push(
    `**Kills:** ${normalizedKillerStats.kills} | **Deaths:** ${normalizedKillerStats.deaths} | **KD:** ${normalizedKillerStats.kd.toFixed(2)}`
  );
  lines.push(`**Kill Streak:** ${normalizedKillerStats.killStreak}`);
  lines.push("");
  lines.push(...buildVictimStatsLines(victimName, victimStats));

  return {
    embeds: [
      new EmbedBuilder()
        .setColor(0xe11d48)
        .setDescription(lines.join("\n"))
        .setFooter({ text: "Bellok's Killfeed" })
        .setTimestamp(eventTimestamp ? new Date(eventTimestamp) : new Date()),
    ],
  };
}

export function embedExplosion(
  { victim, device, victimPosition, t }: ExplosionKillEvent,
  eventTimestamp: number | null = null,
  victimStats: PersistedPlayerStats | null = null
): KillEmbedPayload {
  const lines: string[] = [];

  lines.push("**💥 Killfeed Notification 💥**");

  const timeDisplay = eventTimestamp
    ? `<t:${Math.floor(eventTimestamp / 1000)}:T>`
    : t || "Unknown time";

  lines.push(`### Explosion Death - ${timeDisplay}`);
  lines.push("");

  const victimName = sanitizePlayerName(victim);
  const deviceName = device || "explosive";

  lines.push(`\`${victimName}\` died from "${deviceName}" explosion`);
  lines.push(buildLocationLine(victimPosition));
  lines.push("");
  lines.push(...buildVictimStatsLines(victimName, victimStats));

  return {
    embeds: [
      new EmbedBuilder()
        .setColor(0xf59e0b)
        .setDescription(lines.join("\n"))
        .setFooter({ text: "Bellok's Killfeed" })
        .setTimestamp(eventTimestamp ? new Date(eventTimestamp) : new Date()),
    ],
  };
}

export function buildKillEmbed(
  kill: KillEvent,
  eventTimestamp: number | null = null,
  killerStats: PersistedPlayerStats | null = null,
  victimStats: PersistedPlayerStats | null = null
): KillEmbedPayload | null {
  if (kill.type === "pvp") {
    return embedPvp(kill, eventTimestamp, killerStats, victimStats);
  }

  if (kill.type === "explosion") {
    return embedExplosion(kill, eventTimestamp, victimStats);
  }

  return null;
}
