// Format premium killfeed notifications

import type {
  ExplosionKillEvent,
  KillEvent,
  PlayerStats,
  PvPKillEvent,
} from "../../types/domainEvents";

export function formatKillfeedNotification(
  event: KillEvent | null | undefined,
  killerStats: PlayerStats | null = null,
  victimStats: PlayerStats | null = null
): string | null {
  if (!event) {
    return null;
  }

  if (event.type === "pvp") {
    return formatPvPNotification(event, killerStats, victimStats);
  }

  if (event.type === "explosion") {
    return formatExplosionNotification(event, victimStats);
  }

  return null;
}

function formatPvPNotification(
  event: PvPKillEvent,
  killerStats: PlayerStats | null = null,
  victimStats: PlayerStats | null = null
): string {
  const lines: string[] = [];

  lines.push("**💀 Killfeed Notification 💀**");
  lines.push(`**PVP Kill - ${event.t ?? "N/A"}**`);

  const killerName = event.killer ?? "N/A";
  const victimName = event.victim ?? "N/A";

  lines.push(`\`${killerName}\` ended \`${victimName}\``);

  if (event.weapon) {
    if (event.ammo) {
      lines.push(`**Weapon** ${event.weapon} (${event.ammo})`);
    } else {
      lines.push(`**Weapon** ${event.weapon}`);
    }
  } else {
    lines.push("**Weapon** N/A");
  }

  const distance = event.distanceMeters !== null ? event.distanceMeters.toFixed(2) : "0.00";

  lines.push(`**Distance** ${distance} meters`);

  if (event.hitZone && event.damage !== null) {
    lines.push(`**Hit** ${event.hitZone} ${event.damage} damage`);
  } else if (event.hitZone) {
    lines.push(`**Hit** ${event.hitZone} N/A damage`);
  } else if (event.damage !== null) {
    lines.push(`**Hit** N/A ${event.damage} damage`);
  } else {
    lines.push("**Hit** N/A");
  }

  if (event.victimPosition) {
    const { x, y, z } = event.victimPosition;

    lines.push(`**Location** ${x.toFixed(1)};${y.toFixed(1)};${z.toFixed(1)}`);
  } else {
    lines.push("**Location** N/A");
  }

  lines.push(`**Killer:** \`${killerName}\``);

  if (killerStats) {
    lines.push(`**Rank:** ${killerStats.rank} | **Score:** ${killerStats.score.toFixed(1)}`);
    lines.push(
      `**Kills:** ${killerStats.kills} | **Deaths:** ${killerStats.deaths} | **KD:** ${killerStats.kd.toFixed(2)}`
    );
    lines.push(`**Kill Streak:** ${killerStats.killStreak}`);
  } else {
    lines.push("**Rank:** N/A | **Score:** N/A");
    lines.push("**Kills:** N/A | **Deaths:** N/A | **KD:** N/A");
    lines.push("**Kill Streak:** N/A");
  }

  lines.push(`**Victim:** \`${victimName}\``);

  if (victimStats) {
    lines.push(`**Rank:** ${victimStats.rank} | **Score:** ${victimStats.score.toFixed(1)}`);
    lines.push(
      `**Kills:** ${victimStats.kills} | **Deaths:** ${victimStats.deaths} | **KD:** ${victimStats.kd.toFixed(2)}`
    );
  } else {
    lines.push("**Rank:** N/A | **Score:** N/A");
    lines.push("**Kills:** N/A | **Deaths:** N/A | **KD:** N/A");
  }

  const timeAlive = victimStats?.lastTimeAlive ?? "N/A";

  lines.push(`**Time Alive** ${timeAlive}`);

  return lines.join("\n");
}

function getExplosionPhrase(device: string | null): string {
  if (!device) {
    return "was blown up by unknown device";
  }

  const deviceLower = device.toLowerCase();

  if (deviceLower.includes("grenade")) {
    return "played hot potato with a Grenade";
  }

  if (deviceLower.includes("landmine")) {
    return "stepped on a Landmine";
  }

  if (deviceLower.includes("ied")) {
    return "was blown up by an IED";
  }

  if (deviceLower.includes("tripwire")) {
    return "triggered a Tripwire";
  }

  return `was blown up by ${device}`;
}

function formatExplosionNotification(
  event: ExplosionKillEvent,
  victimStats: PlayerStats | null = null
): string {
  const lines: string[] = [];

  lines.push("**💥 Killfeed Notification 💥**");
  lines.push(`**Explosion Death - ${event.t ?? "N/A"}**`);

  const victimName = event.victim ?? "N/A";
  const explosionPhrase = getExplosionPhrase(event.device);

  lines.push(`\`${victimName}\` ${explosionPhrase}`);

  if (event.victimPosition) {
    const { x, y, z } = event.victimPosition;

    lines.push(`**Location** ${x.toFixed(1)};${y.toFixed(1)};${z.toFixed(1)}`);
  } else {
    lines.push("**Location** N/A");
  }

  const timeAlive = victimStats?.lastTimeAlive ?? "N/A";

  lines.push(`**Time Alive** ${timeAlive}`);

  return lines.join("\n");
}
