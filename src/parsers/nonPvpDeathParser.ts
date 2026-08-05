import type { NonPvpDeathCause, NonPvpDeathEvent, Position3D } from "../types/domainEvents.js";
import { cleanPlayerName, extractPosition } from "./killParser.js";

const TIME_RE = /^\s*(\d{2}:\d{2}:\d{2})\s*\|/;
const PLAYER_RE = /Player\s+["'“”](.+?)["'“”]/i;

interface EntityDeathPattern {
  cause: NonPvpDeathCause;
  pattern: RegExp;
}

const ENTITY_DEATH_PATTERNS: EntityDeathPattern[] = [
  {
    cause: "zombie",
    pattern: /\bkilled by\s+(ZmbM_[A-Za-z0-9_]+)\b/i,
  },
  {
    cause: "wolf",
    pattern: /\bkilled by\s+(Animal_CanisLupus[A-Za-z0-9_]*)\b/i,
  },
  {
    cause: "bear",
    pattern: /\bkilled by\s+(Animal_UrsusArctos)\b/i,
  },
];

function extractVictimPosition(line: string): Position3D | null {
  return extractPosition(line);
}

export function parseNonPvpDeath(line: string): NonPvpDeathEvent | null {
  if (!/\(DEAD\)/i.test(line)) {
    return null;
  }

  const playerMatch = line.match(PLAYER_RE);

  if (!playerMatch) {
    return null;
  }

  const victim = cleanPlayerName(playerMatch[1]);

  if (!victim) {
    return null;
  }

  const timeMatch = line.match(TIME_RE);
  const t = timeMatch ? timeMatch[1] : null;

  for (const { cause, pattern } of ENTITY_DEATH_PATTERNS) {
    const entityMatch = line.match(pattern);

    if (!entityMatch) {
      continue;
    }

    const event: NonPvpDeathEvent = {
      type: "non-pvp-death",
      victim,
      cause,
      entity: entityMatch[1],
      t,
      line,
    };

    const victimPosition = extractVictimPosition(line);

    if (victimPosition) {
      event.victimPosition = victimPosition;
    }

    return event;
  }

  if (/\bdied\. Stats>/i.test(line)) {
    const event: NonPvpDeathEvent = {
      type: "non-pvp-death",
      victim,
      cause: "general",
      entity: null,
      t,
      line,
    };

    const victimPosition = extractVictimPosition(line);

    if (victimPosition) {
      event.victimPosition = victimPosition;
    }

    return event;
  }

  return null;
}
