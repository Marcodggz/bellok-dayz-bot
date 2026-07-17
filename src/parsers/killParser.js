// src/parsers/killParser.js — Parse DayZ kill events from log lines
// ADM pos=<X, Y, Z>: X/Y are map coordinates; Z is elevation.

// ================== PARSER CONSTANTS ==================
const TIME_RE = /^\s*(\d{2}:\d{2}:\d{2})\s*\|/;
const q = `["'""]`;
const EXPLO = /explosion|grenade|mine|landmine|tripwire|ied/i;

// PvP: "killed Player ..." y "(DEAD) ... killed by Player ..."
const PVP_PATTERNS = [
  new RegExp(
    `Player ${q}(.+?)${q}[^|\\r\\n]*?killed Player ${q}(.+?)${q}[^|\\r\\n]*?(?:\\s+with\\s+([^\\s|\\r\\n(]+))?`,
    "i",
  ),
  new RegExp(
    `Player ${q}(.+?)${q}[^|\\r\\n]*?(?:\\(DEAD\\)\\s*)?(?:was\\s+)?killed by Player ${q}(.+?)${q}[^|\\r\\n]*?(?:\\s+with\\s+([^\\s|\\r\\n(]+))?`,
    "i",
  ),
];

// ================== HELPER FUNCTIONS ==================

/**
 * Clean player name by removing surrounding quotes
 */
function cleanPlayerName(name) {
  if (!name) return null;
  return String(name)
    .replace(/^["'""]|["'""]$/g, "")
    .trim();
}

/**
 * Extract weapon name from log line
 */
function extractWeapon(line) {
  const weaponMatch = line.match(/\s+with\s+([A-Za-z0-9_-]+)/i);
  return weaponMatch ? weaponMatch[1].trim() : null;
}

/**
 * Extract position coordinates from text like "pos=<7234.5, 5678.2, 302.1>"
 */
function extractPosition(text) {
  const posMatch = text.match(/pos=<([\d.]+),\s*([\d.]+),\s*([\d.]+)>/);
  if (posMatch) {
    return {
      x: parseFloat(posMatch[1]),
      y: parseFloat(posMatch[2]),
      z: parseFloat(posMatch[3]),
    };
  }
  return null;
}

/**
 * Extract distance in meters from text like "from 15.2 meters"
 */
function extractDistance(text) {
  const distMatch = text.match(/from\s+([\d.]+)\s+meters/i);
  return distMatch ? parseFloat(distMatch[1]) : null;
}

/**
 * Extract ammo type from text like "(Ammo: 5.56x45mm NATO, ...)"
 */
function extractAmmo(text) {
  const ammoMatch = text.match(/Ammo:\s*([^,)]+)/i);
  return ammoMatch ? ammoMatch[1].trim() : null;
}

/**
 * Extract hit zone from text like "Hit: Torso"
 */
function extractHitZone(text) {
  const hitMatch = text.match(/Hit:\s*([^,)]+)/i);
  return hitMatch ? hitMatch[1].trim() : null;
}

/**
 * Extract damage value from text like "Damage: 85"
 */
function extractDamage(text) {
  const dmgMatch = text.match(/Damage:\s*([\d.]+)/i);
  return dmgMatch ? parseFloat(dmgMatch[1]) : null;
}

/**
 * Check if a log line should be ignored (not a kill event)
 */
function shouldIgnore(line) {
  if (/##### PlayerList log/i.test(line)) return true;
  if (/ is connected| has been disconnected/i.test(line)) return true;
  if (/performed Emote(?!Suicide)/i.test(line)) return true;
  return false;
}

/**
 * Clean weapon name from log text
 */
function cleanWeapon(s) {
  if (!s) return null;
  return String(s)
    .replace(/\s+from.*$/i, "")
    .replace(/\s+at.*$/i, "")
    .replace(/\s*\(.*?\)\s*$/, "")
    .trim();
}

/**
 * Clean explosive device name from log text
 */
function cleanDevice(s) {
  if (!s) return null;
  return String(s)
    .replace(/^an?\s+/i, "")
    .replace(/\s+from.*$/i, "")
    .replace(/\s*\(.*?\)\s*$/, "")
    .trim();
}

// ================== MAIN PARSER ==================

/**
 * Parse a kill event from a log line
 * Returns: { type: 'pvp'|'explosion', killer?, victim, weapon?, device?, t, line,
 *            distanceMeters?, ammo?, hitZone?, damage?, killerPosition?, victimPosition? } or null
 */
function parseKill(line) {
  if (shouldIgnore(line)) return null;
  const tm = line.match(TIME_RE);
  const t = tm ? tm[1] : null;

  // Try PvP patterns
  for (const re of PVP_PATTERNS) {
    const m = line.match(re);
    if (m) {
      let killer, victim, killerRaw, victimRaw, weapon;
      if (/killed Player/i.test(re.source)) {
        killerRaw = m[1];
        victimRaw = m[2];
        killer = cleanPlayerName(killerRaw);
        victim = cleanPlayerName(victimRaw);
        weapon = extractWeapon(line);
      } else {
        victimRaw = m[1];
        killerRaw = m[2];
        victim = cleanPlayerName(victimRaw);
        killer = cleanPlayerName(killerRaw);
        weapon = extractWeapon(line);
      }

      // Extract additional PvP data
      const result = { type: "pvp", killer, victim, weapon, t, line };

      // Extract positions - look for the killer's position first, then victim's (use raw names for pattern matching)
      const killerPosPattern = new RegExp(
        `Player ${q}${escapeRegExp(killerRaw)}${q}[^<]*pos=<([^>]+)>`,
        "i",
      );
      const victimPosPattern = new RegExp(
        `Player ${q}${escapeRegExp(victimRaw)}${q}[^<]*pos=<([^>]+)>`,
        "i",
      );

      const killerPosMatch = line.match(killerPosPattern);
      const victimPosMatch = line.match(victimPosPattern);

      if (killerPosMatch) {
        result.killerPosition = extractPosition(`pos=<${killerPosMatch[1]}>`);
      }
      if (victimPosMatch) {
        result.victimPosition = extractPosition(`pos=<${victimPosMatch[1]}>`);
      }

      // Extract distance, ammo, hit zone, damage
      result.distanceMeters = extractDistance(line);
      result.ammo = extractAmmo(line);
      result.hitZone = extractHitZone(line);
      result.damage = extractDamage(line);

      return result;
    }
  }

  // Try explosion pattern
  {
    const m = line.match(
      new RegExp(`Player ${q}(.+?)${q}.*?killed by ([^|\\r\\n]+)`, "i"),
    );
    if (m) {
      const victimRaw = m[1];
      const victim = cleanPlayerName(victimRaw);
      const cause = m[2].trim();
      if (EXPLO.test(cause)) {
        const device = cleanDevice(cause);
        const result = { type: "explosion", victim, device, t, line };

        // Extract victim position for explosion deaths (use raw name for pattern matching)
        const victimPosPattern = new RegExp(
          `Player ${q}${escapeRegExp(victimRaw)}${q}[^<]*pos=<([^>]+)>`,
          "i",
        );
        const victimPosMatch = line.match(victimPosPattern);

        if (victimPosMatch) {
          result.victimPosition = extractPosition(`pos=<${victimPosMatch[1]}>`);
        }

        return result;
      }
    }
  }

  return null;
}

// Helper function for escaping regex special characters
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ================== EXPORTS ==================
module.exports = {
  shouldIgnore,
  cleanPlayerName,
  cleanWeapon,
  cleanDevice,
  extractWeapon,
  extractPosition,
  extractDistance,
  extractAmmo,
  extractHitZone,
  extractDamage,
  parseKill,
};
