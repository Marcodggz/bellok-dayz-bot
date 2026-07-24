// Parse DayZ kill events from ADM log lines
// ADM pos=<X, Y, Z>: X/Y are map coordinates; Z is elevation.

import type {
  ExplosionKillEvent,
  KillEvent,
  Position3D,
  PvPKillEvent,
} from "../types/domainEvents";

const TIME_RE = /^\s*(\d{2}:\d{2}:\d{2})\s*\|/;
const q = `["'""]`;
const EXPLO = /explosion|grenade|mine|landmine|tripwire|ied/i;

const PVP_PATTERNS: RegExp[] = [
  new RegExp(
    `Player ${q}(.+?)${q}[^|\\r\\n]*?killed Player ${q}(.+?)${q}[^|\\r\\n]*?(?:\\s+with\\s+([^\\s|\\r\\n(]+))?`,
    "i"
  ),
  new RegExp(
    `Player ${q}(.+?)${q}[^|\\r\\n]*?(?:\\(DEAD\\)\\s*)?(?:was\\s+)?killed by Player ${q}(.+?)${q}[^|\\r\\n]*?(?:\\s+with\\s+([^\\s|\\r\\n(]+))?`,
    "i"
  ),
];

export function cleanPlayerName(name: string | null | undefined): string | null {
  if (!name) {
    return null;
  }

  return String(name)
    .replace(/^["'""]|["'""]$/g, "")
    .trim();
}

export function extractWeapon(line: string): string | null {
  const weaponMatch = line.match(/\s+with\s+([A-Za-z0-9_-]+)/i);

  return weaponMatch ? weaponMatch[1].trim() : null;
}

export function extractPosition(text: string): Position3D | null {
  const posMatch = text.match(/pos=<([\d.]+),\s*([\d.]+),\s*([\d.]+)>/);

  if (!posMatch) {
    return null;
  }

  return {
    x: parseFloat(posMatch[1]),
    y: parseFloat(posMatch[2]),
    z: parseFloat(posMatch[3]),
  };
}

export function extractDistance(text: string): number | null {
  const distMatch = text.match(/from\s+([\d.]+)\s+meters/i);

  return distMatch ? parseFloat(distMatch[1]) : null;
}

export function extractAmmo(text: string): string | null {
  const ammoMatch = text.match(/Ammo:\s*([^,)]+)/i);

  return ammoMatch ? ammoMatch[1].trim() : null;
}

export function extractHitZone(text: string): string | null {
  const hitMatch = text.match(/Hit:\s*([^,)]+)/i);

  return hitMatch ? hitMatch[1].trim() : null;
}

export function extractDamage(text: string): number | null {
  const damageMatch = text.match(/Damage:\s*([\d.]+)/i);

  return damageMatch ? parseFloat(damageMatch[1]) : null;
}

export function shouldIgnore(line: string): boolean {
  if (/##### PlayerList log/i.test(line)) {
    return true;
  }

  if (/ is connected| has been disconnected/i.test(line)) {
    return true;
  }

  return /performed Emote(?!Suicide)/i.test(line);
}

export function cleanWeapon(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  return String(value)
    .replace(/\s+from.*$/i, "")
    .replace(/\s+at.*$/i, "")
    .replace(/\s*\(.*?\)\s*$/, "")
    .trim();
}

export function cleanDevice(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  return String(value)
    .replace(/^an?\s+/i, "")
    .replace(/\s+from.*$/i, "")
    .replace(/\s*\(.*?\)\s*$/, "")
    .trim();
}

export function parseKill(line: string): KillEvent | null {
  if (shouldIgnore(line)) {
    return null;
  }

  const timeMatch = line.match(TIME_RE);
  const t = timeMatch ? timeMatch[1] : null;

  for (const pattern of PVP_PATTERNS) {
    const match = line.match(pattern);

    if (!match) {
      continue;
    }

    let killerRaw: string;
    let victimRaw: string;

    if (/killed Player/i.test(pattern.source)) {
      killerRaw = match[1];
      victimRaw = match[2];
    } else {
      victimRaw = match[1];
      killerRaw = match[2];
    }

    const result: PvPKillEvent = {
      type: "pvp",
      killer: cleanPlayerName(killerRaw),
      victim: cleanPlayerName(victimRaw),
      weapon: extractWeapon(line),
      distanceMeters: extractDistance(line),
      ammo: extractAmmo(line),
      hitZone: extractHitZone(line),
      damage: extractDamage(line),
      t,
      line,
    };

    const killerPositionPattern = new RegExp(
      `Player ${q}${escapeRegExp(killerRaw)}${q}[^<]*pos=<([^>]+)>`,
      "i"
    );
    const victimPositionPattern = new RegExp(
      `Player ${q}${escapeRegExp(victimRaw)}${q}[^<]*pos=<([^>]+)>`,
      "i"
    );

    const killerPositionMatch = line.match(killerPositionPattern);
    const victimPositionMatch = line.match(victimPositionPattern);

    if (killerPositionMatch) {
      const killerPosition = extractPosition(`pos=<${killerPositionMatch[1]}>`);

      if (killerPosition) {
        result.killerPosition = killerPosition;
      }
    }

    if (victimPositionMatch) {
      const victimPosition = extractPosition(`pos=<${victimPositionMatch[1]}>`);

      if (victimPosition) {
        result.victimPosition = victimPosition;
      }
    }

    return result;
  }

  const explosionMatch = line.match(
    new RegExp(`Player ${q}(.+?)${q}.*?killed by ([^|\\r\\n]+)`, "i")
  );

  if (explosionMatch) {
    const victimRaw = explosionMatch[1];
    const cause = explosionMatch[2].trim();

    if (EXPLO.test(cause)) {
      const result: ExplosionKillEvent = {
        type: "explosion",
        victim: cleanPlayerName(victimRaw),
        device: cleanDevice(cause),
        t,
        line,
      };

      const victimPositionPattern = new RegExp(
        `Player ${q}${escapeRegExp(victimRaw)}${q}[^<]*pos=<([^>]+)>`,
        "i"
      );
      const victimPositionMatch = line.match(victimPositionPattern);

      if (victimPositionMatch) {
        const victimPosition = extractPosition(`pos=<${victimPositionMatch[1]}>`);

        if (victimPosition) {
          result.victimPosition = victimPosition;
        }
      }

      return result;
    }
  }

  return null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
