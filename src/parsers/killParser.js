// src/parsers/killParser.js — Parse DayZ kill events from log lines

// ================== PARSER CONSTANTS ==================
const TIME_RE = /^\s*(\d{2}:\d{2}:\d{2})\s*\|/;
const q = `["'""]`;
const EXPLO = /explosion|grenade|mine|landmine|tripwire|ied/i;

// PvP: "killed Player ..." y "(DEAD) ... killed by Player ..."
const PVP_PATTERNS = [
  new RegExp(
    `Player ${q}(.+?)${q}[^|\\r\\n]*?killed Player ${q}(.+?)${q}[^|\\r\\n]*?(?: with ([^|\\r\\n]+?))?(?: from| at| \\(|$)`,
    "i",
  ),
  new RegExp(
    `Player ${q}(.+?)${q}[^|\\r\\n]*?(?:\\(DEAD\\)\\s*)?(?:was\\s+)?killed by Player ${q}(.+?)${q}[^|\\r\\n]*?(?: with ([^|\\r\\n]+?))?(?: from| at| \\(|$)`,
    "i",
  ),
];

// ================== HELPER FUNCTIONS ==================

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
 * Returns: { type: 'pvp'|'explosion', killer?, victim, weapon?, device?, t, line } or null
 */
function parseKill(line) {
  if (shouldIgnore(line)) return null;
  const tm = line.match(TIME_RE);
  const t = tm ? tm[1] : null;

  // Try PvP patterns
  for (const re of PVP_PATTERNS) {
    const m = line.match(re);
    if (m) {
      let killer, victim, weapon;
      if (/killed Player/i.test(re.source)) {
        killer = m[1];
        victim = m[2];
        weapon = cleanWeapon(m[3]);
      } else {
        victim = m[1];
        killer = m[2];
        weapon = cleanWeapon(m[3]);
      }
      return { type: "pvp", killer, victim, weapon, t, line };
    }
  }

  // Try explosion pattern
  {
    const m = line.match(
      new RegExp(`Player ${q}(.+?)${q}.*?killed by ([^|\\r\\n]+)`, "i"),
    );
    if (m) {
      const victim = m[1];
      const cause = m[2].trim();
      if (EXPLO.test(cause)) {
        const device = cleanDevice(cause);
        return { type: "explosion", victim, device, t, line };
      }
    }
  }

  return null;
}

// ================== EXPORTS ==================
module.exports = {
  shouldIgnore,
  cleanWeapon,
  cleanDevice,
  parseKill,
};
