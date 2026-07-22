// src/features/killfeed/embedBuilders.js — Killfeed Discord embed builders
// ADM pos=<X, Y, Z>: X/Y are map coordinates; Z is elevation.

const { EmbedBuilder } = require("discord.js");
const { IZURVIVE_MAP_SLUG } = require("../../config/config");

function buildIzurviveLocationUrl(x, y, zoom = 8) {
  return `https://www.izurvive.com/${IZURVIVE_MAP_SLUG}/#location=${x};${y};${zoom}`;
}

function sanitizePlayerName(name) {
  return String(name || "Unknown").replace(/`/g, "'");
}

function buildLocationLine(position) {
  if (position && position.x && position.y && position.z) {
    const { x, y, z } = position;
    const coordsText = `${x.toFixed(1)};${y.toFixed(1)};${z.toFixed(1)}`;
    const url = buildIzurviveLocationUrl(x, y);
    return `**Location** [${coordsText}](${url})`;
  }

  return "**Location** N/A";
}

function buildVictimStatsLines(victimName, stats) {
  const normalizedStats = normalizeStats(stats);

  return [
    `__**Victim:**__ \`${victimName}\``,
    `**Rank:** ${normalizedStats.rank} | **Score:** ${normalizedStats.score.toFixed(1)}`,
    `**Kills:** ${normalizedStats.kills} | **Deaths:** ${normalizedStats.deaths} | **KD:** ${normalizedStats.kd.toFixed(2)}`,
    `**Time Alive:** ${normalizedStats.lastTimeAlive}`,
  ];
}

// Deterministic action verb selection based on killer + victim names
function getRandomPvpAction(killer, victim) {
  const actions = ["embarrassed", "eliminated", "shit on"];
  const seed = (killer || "").length + (victim || "").length * 3;
  const index = seed % actions.length;
  return actions[index];
}

// Normalize stats object to ensure all fields are safe for display
function normalizeStats(stats) {
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

function embedPvp(
  { killer, victim, weapon, distanceMeters, ammo, hitZone, damage, victimPosition, t },
  eventTimestamp = null,
  killerStats = null,
  victimStats = null
) {
  const lines = [];

  lines.push(`**⚔️ Killfeed Notification ⚔️**`);

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

function embedExplosion(
  { victim, device, victimPosition, t },
  eventTimestamp = null,
  victimStats = null
) {
  const lines = [];

  lines.push(`**💥 Killfeed Notification 💥**`);

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

function buildKillEmbed(k, eventTimestamp = null, killerStats = null, victimStats = null) {
  if (k.type === "pvp") return embedPvp(k, eventTimestamp, killerStats, victimStats);
  if (k.type === "explosion") return embedExplosion(k, eventTimestamp, victimStats);
  return null;
}

module.exports = {
  buildIzurviveLocationUrl,
  buildLocationLine,
  buildVictimStatsLines,
  sanitizePlayerName,
  getRandomPvpAction,
  embedPvp,
  embedExplosion,
  buildKillEmbed,
};
