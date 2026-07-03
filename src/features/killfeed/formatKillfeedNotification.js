// src/features/killfeed/formatKillfeedNotification.js — Format premium killfeed notifications

/**
 * Format a kill event as a premium killfeed notification
 * @param {Object} event - Parsed kill event from parseKill
 * @param {Object|null} killerStats - Optional killer stats object
 * @param {Object|null} victimStats - Optional victim stats object
 * @returns {string} - Formatted multiline notification text
 */
function formatKillfeedNotification(
  event,
  killerStats = null,
  victimStats = null,
) {
  if (!event) return null;

  if (event.type === "pvp") {
    return formatPvPNotification(event, killerStats, victimStats);
  } else if (event.type === "explosion") {
    return formatExplosionNotification(event, victimStats);
  }

  return null;
}

/**
 * Format a PvP kill event notification
 * @param {Object} event - Parsed kill event
 * @param {Object|null} killerStats - Optional killer stats object
 * @param {Object|null} victimStats - Optional victim stats object
 */
function formatPvPNotification(event, killerStats = null, victimStats = null) {
  const lines = [];

  // Title and header lines - bold
  lines.push("**💀 Killfeed Notification 💀**");
  lines.push(`**PVP Kill - ${event.t || "N/A"}**`);

  // Killer ended victim line - wrap names in backticks
  const killerName = event.killer || "N/A";
  const victimName = event.victim || "N/A";
  lines.push(`\`${killerName}\` ended \`${victimName}\``);

  // Weapon line - bold label
  if (event.weapon) {
    if (event.ammo) {
      lines.push(`**Weapon** ${event.weapon} (${event.ammo})`);
    } else {
      lines.push(`**Weapon** ${event.weapon}`);
    }
  } else {
    lines.push(`**Weapon** N/A`);
  }

  // Distance line - bold label, show 0.00 if missing, otherwise show with 2 decimal places
  const distance =
    event.distanceMeters !== null && event.distanceMeters !== undefined
      ? event.distanceMeters.toFixed(2)
      : "0.00";
  lines.push(`**Distance** ${distance} meters`);

  // Hit line - bold label
  if (event.hitZone && event.damage !== null && event.damage !== undefined) {
    lines.push(`**Hit** ${event.hitZone} ${event.damage} damage`);
  } else if (event.hitZone) {
    lines.push(`**Hit** ${event.hitZone} N/A damage`);
  } else if (event.damage !== null && event.damage !== undefined) {
    lines.push(`**Hit** N/A ${event.damage} damage`);
  } else {
    lines.push(`**Hit** N/A`);
  }

  // Location line - bold label (use victim position)
  if (event.victimPosition) {
    const { x, y, z } = event.victimPosition;
    lines.push(`**Location** ${x.toFixed(1)};${y.toFixed(1)};${z.toFixed(1)}`);
  } else {
    lines.push(`**Location** N/A`);
  }

  // Killer stats - bold labels
  lines.push(`**Killer:** \`${killerName}\``);
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

  // Victim stats - bold labels
  lines.push(`**Victim:** \`${victimName}\``);
  if (victimStats) {
    lines.push(
      `**Rank:** ${victimStats.rank} | **Score:** ${victimStats.score.toFixed(1)}`,
    );
    lines.push(
      `**Kills:** ${victimStats.kills} | **Deaths:** ${victimStats.deaths} | **KD:** ${victimStats.kd.toFixed(2)}`,
    );
  } else {
    lines.push(`**Rank:** N/A | **Score:** N/A`);
    lines.push(`**Kills:** N/A | **Deaths:** N/A | **KD:** N/A`);
  }

  // Time Alive - show lastTimeAlive if available
  const timeAlive =
    victimStats && victimStats.lastTimeAlive
      ? victimStats.lastTimeAlive
      : "N/A";
  lines.push(`**Time Alive** ${timeAlive}`);

  return lines.join("\n");
}

/**
 * Get explosion phrase based on device type
 */
function getExplosionPhrase(device) {
  if (!device) return "was blown up by unknown device";

  const deviceLower = device.toLowerCase();

  if (deviceLower.includes("grenade")) {
    return "played hot potato with a Grenade";
  } else if (deviceLower.includes("landmine")) {
    return "stepped on a Landmine";
  } else if (deviceLower.includes("ied")) {
    return "was blown up by an IED";
  } else if (deviceLower.includes("tripwire")) {
    return "triggered a Tripwire";
  } else {
    return `was blown up by ${device}`;
  }
}

/**
 * Format an explosion death event notification
 * @param {Object} event - Parsed kill event
 * @param {Object|null} victimStats - Optional victim stats object (not used for explosions)
 */
function formatExplosionNotification(event, victimStats = null) {
  const lines = [];

  // Title and header lines - bold
  lines.push("**💥 Killfeed Notification 💥**");
  lines.push(`**Explosion Death - ${event.t || "N/A"}**`);

  // Victim with explosion phrase - wrap victim name in backticks
  const victimName = event.victim || "N/A";
  const explosionPhrase = getExplosionPhrase(event.device);
  lines.push(`\`${victimName}\` ${explosionPhrase}`);

  // Location line - bold label (use victim position)
  if (event.victimPosition) {
    const { x, y, z } = event.victimPosition;
    lines.push(`**Location** ${x.toFixed(1)};${y.toFixed(1)};${z.toFixed(1)}`);
  } else {
    lines.push(`**Location** N/A`);
  }

  // Time Alive - show lastTimeAlive if available
  const timeAlive =
    victimStats && victimStats.lastTimeAlive
      ? victimStats.lastTimeAlive
      : "N/A";
  lines.push(`**Time Alive** ${timeAlive}`);

  return lines.join("\n");
}

// ================== EXPORTS ==================
module.exports = {
  formatKillfeedNotification,
};
