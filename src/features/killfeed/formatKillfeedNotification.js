// src/features/killfeed/formatKillfeedNotification.js — Format premium killfeed notifications

/**
 * Format a kill event as a premium killfeed notification
 * @param {Object} event - Parsed kill event from parseKill
 * @returns {string} - Formatted multiline notification text
 */
function formatKillfeedNotification(event) {
  if (!event) return null;

  if (event.type === "pvp") {
    return formatPvPNotification(event);
  } else if (event.type === "explosion") {
    return formatExplosionNotification(event);
  }

  return null;
}

/**
 * Format a PvP kill event notification
 */
function formatPvPNotification(event) {
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
  lines.push(`**Rank:** N/A | **Score:** N/A`);
  lines.push(`**Kills:** N/A | **Deaths:** N/A | **KD:** N/A`);
  lines.push(`**Kill Streak:** N/A`);

  // Victim stats - bold labels
  lines.push(`**Victim:** \`${victimName}\``);
  lines.push(`**Rank:** N/A | **Score:** N/A`);
  lines.push(`**Kills:** N/A | **Deaths:** N/A | **KD:** N/A`);
  lines.push(`**Time Alive:** N/A`);

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
 */
function formatExplosionNotification(event) {
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

  // Time Alive - bold label
  lines.push(`**Time Alive** N/A`);

  return lines.join("\n");
}

// ================== EXPORTS ==================
module.exports = {
  formatKillfeedNotification,
};
