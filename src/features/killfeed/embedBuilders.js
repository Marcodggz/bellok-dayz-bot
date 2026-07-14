// src/features/killfeed/embedBuilders.js — Killfeed Discord embed builders

const { EmbedBuilder } = require("discord.js");

function buildIzurviveLocationUrl(x, y, zoom = 8) {
  return `https://www.izurvive.com/chernarusplus#location=${x};${y};${zoom}`;
}

// Deterministic action verb selection based on killer + victim names
function getRandomPvpAction(killer, victim) {
  const actions = ["embarrassed", "eliminated", "shit on"];
  const seed = (killer || "").length + (victim || "").length * 3;
  const index = seed % actions.length;
  return actions[index];
}

function embedPvp(
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
  },
  eventTimestamp = null,
  killerStats = null,
  victimStats = null,
) {
  const lines = [];

  lines.push(`**⚔️ Killfeed Notification ⚔️**`);

  // Convert HH:MM:SS to 12-hour format with a.m./p.m.
  let timeDisplay = "N/A";
  if (t) {
    const match = t.match(/^(\d{2}):(\d{2}):(\d{2})$/);
    if (match) {
      let hours = parseInt(match[1], 10);
      const minutes = match[2];
      const seconds = match[3];
      const period = hours >= 12 ? "p.m." : "a.m.";
      hours = hours % 12 || 12;
      timeDisplay = `${hours}:${minutes}:${seconds} ${period}`;
    } else {
      timeDisplay = t;
    }
  } else if (eventTimestamp) {
    const date = new Date(eventTimestamp);
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    const period = hours >= 12 ? "p.m." : "a.m.";
    hours = hours % 12 || 12;
    timeDisplay = `${hours}:${minutes}:${seconds} ${period}`;
  }

  lines.push(`### PVP Kill - \`${timeDisplay}\``);
  lines.push("");

  const killerName = killer || "Unknown";
  const victimName = victim || "Unknown";
  const action = getRandomPvpAction(killerName, victimName);
  lines.push(`\`${killerName}\` ${action} \`${victimName}\``);

  const weaponText = weapon || "N/A";
  lines.push(`**Weapon** ${weaponText}`);

  const distanceText =
    distanceMeters !== null && distanceMeters !== undefined
      ? distanceMeters.toFixed(0)
      : "0";
  lines.push(`**Distance** ${distanceText} meters`);

  const hitZoneText = hitZone || "N/A";
  const damageText =
    damage !== null && damage !== undefined ? damage.toFixed(0) : "N/A";
  lines.push(`**Hit** ${hitZoneText} ${damageText} damage`);

  if (
    victimPosition &&
    victimPosition.x &&
    victimPosition.y &&
    victimPosition.z
  ) {
    const { x, y, z } = victimPosition;
    const coordsText = `${x.toFixed(1)};${y.toFixed(1)};${z.toFixed(1)}`;
    const url = buildIzurviveLocationUrl(x, y);
    lines.push(`**Location** [${coordsText}](${url})`);
  } else {
    lines.push(`**Location** N/A`);
  }

  lines.push("");

  lines.push(`__**Killer:**__ \`${killerName}\``);
  if (killerStats) {
    lines.push(
      `**Rank:** ${killerStats.rank} | **Score:** ${killerStats.score.toFixed(1)}`,
    );
    lines.push(
      `**Kills:** ${killerStats.kills} | **Deaths:** ${killerStats.deaths} | **KD:** ${killerStats.kd.toFixed(2)}`,
    );
    lines.push(`**Kill Streak:** ${killerStats.killStreak}`);
  } else {
    lines.push(`**Rank:** N/A | **Score:** N/A`);
    lines.push(`**Kills:** N/A | **Deaths:** N/A | **KD:** N/A`);
    lines.push(`**Kill Streak:** N/A`);
  }

  lines.push("");

  lines.push(`__**Victim:**__ \`${victimName}\``);
  if (victimStats) {
    lines.push(
      `**Rank:** ${victimStats.rank} | **Score:** ${victimStats.score.toFixed(1)}`,
    );
    lines.push(
      `**Kills:** ${victimStats.kills} | **Deaths:** ${victimStats.deaths} | **KD:** ${victimStats.kd.toFixed(2)}`,
    );
    const timeAlive = victimStats.lastTimeAlive || "N/A";
    lines.push(`**Time Alive:** ${timeAlive}`);
  } else {
    lines.push(`**Rank:** N/A | **Score:** N/A`);
    lines.push(`**Kills:** N/A | **Deaths:** N/A | **KD:** N/A`);
    lines.push(`**Time Alive:** N/A`);
  }

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
  victimStats = null,
) {
  const lines = [];

  lines.push(`**💥 Killfeed Notification 💥**`);

  // Convert HH:MM:SS to 12-hour format with a.m./p.m.
  let timeDisplay = "N/A";
  if (t) {
    const match = t.match(/^(\d{2}):(\d{2}):(\d{2})$/);
    if (match) {
      let hours = parseInt(match[1], 10);
      const minutes = match[2];
      const seconds = match[3];
      const period = hours >= 12 ? "p.m." : "a.m.";
      hours = hours % 12 || 12;
      timeDisplay = `${hours}:${minutes}:${seconds} ${period}`;
    } else {
      timeDisplay = t;
    }
  } else if (eventTimestamp) {
    const date = new Date(eventTimestamp);
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    const period = hours >= 12 ? "p.m." : "a.m.";
    hours = hours % 12 || 12;
    timeDisplay = `${hours}:${minutes}:${seconds} ${period}`;
  }

  lines.push(`### Explosion Death - \`${timeDisplay}\``);
  lines.push("");

  const victimName = victim || "Unknown";
  const deviceName = device || "explosive";
  lines.push(`\`${victimName}\` died from "${deviceName}" explosion`);

  if (
    victimPosition &&
    victimPosition.x &&
    victimPosition.y &&
    victimPosition.z
  ) {
    const { x, y, z } = victimPosition;
    const coordsText = `${x.toFixed(1)};${y.toFixed(1)};${z.toFixed(1)}`;
    const url = buildIzurviveLocationUrl(x, y);
    lines.push(`**Location** [${coordsText}](${url})`);
  } else {
    lines.push(`**Location** N/A`);
  }

  lines.push("");

  lines.push(`__**Victim:**__ \`${victimName}\``);
  if (victimStats) {
    lines.push(
      `**Rank:** ${victimStats.rank} | **Score:** ${victimStats.score.toFixed(1)}`,
    );
    lines.push(
      `**Kills:** ${victimStats.kills} | **Deaths:** ${victimStats.deaths} | **KD:** ${victimStats.kd.toFixed(2)}`,
    );
    const timeAlive = victimStats.lastTimeAlive || "N/A";
    lines.push(`**Time Alive:** ${timeAlive}`);
  } else {
    lines.push(`**Rank:** N/A | **Score:** N/A`);
    lines.push(`**Kills:** N/A | **Deaths:** N/A | **KD:** N/A`);
    lines.push(`**Time Alive:** N/A`);
  }

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

function buildKillEmbed(
  k,
  eventTimestamp = null,
  killerStats = null,
  victimStats = null,
) {
  if (k.type === "pvp")
    return embedPvp(k, eventTimestamp, killerStats, victimStats);
  if (k.type === "explosion")
    return embedExplosion(k, eventTimestamp, victimStats);
  return null;
}

module.exports = {
  buildIzurviveLocationUrl,
  getRandomPvpAction,
  embedPvp,
  embedExplosion,
  buildKillEmbed,
};
