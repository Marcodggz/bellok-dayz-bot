// Apply confirmed non-PvP ADM deaths to the player life cycle.
// These events never enter the Discord killfeed or PvP heatmap.

import { parseNonPvpDeath } from "../../parsers/nonPvpDeathParser.js";
import type { KillEvent, NonPvpDeathEvent } from "../../types/domainEvents.js";
import type { PersistedPlayerStatsCollection } from "../../types/domainPersistence.js";
import { applyNonPvpDeath } from "./playerStats.js";

function matchesCompetitiveDeath(event: NonPvpDeathEvent, competitiveDeath: KillEvent): boolean {
  return (
    event.t !== null &&
    competitiveDeath.t === event.t &&
    competitiveDeath.victim !== null &&
    competitiveDeath.victim.toLowerCase() === event.victim.toLowerCase()
  );
}

export function processNonPvpDeathLine(
  line: string,
  stats: PersistedPlayerStatsCollection,
  normalizedEventTimeMs: number | null,
  competitiveDeaths: Iterable<KillEvent> = []
): NonPvpDeathEvent | null {
  const event = parseNonPvpDeath(line);

  if (!event) {
    return null;
  }

  if (event.cause === "general") {
    for (const competitiveDeath of competitiveDeaths) {
      if (matchesCompetitiveDeath(event, competitiveDeath)) {
        return null;
      }
    }
  }

  applyNonPvpDeath(stats, event.victim, normalizedEventTimeMs);

  return event;
}
