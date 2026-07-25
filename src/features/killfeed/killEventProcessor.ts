// Process raw ADM log lines into deduplicated kill event groups

import { parseKill } from "../../parsers/killParser.js";
import type { KillEvent } from "../../types/domainEvents.js";
import { updatePositionsFromLine } from "../tracking/positionTracker.js";
import { typeRank, victimBucketKey } from "./killEventDeduplicator.js";

export function processKillEvents(lines: string[]): Map<string, KillEvent> {
  for (const line of lines) {
    updatePositionsFromLine(line);
  }

  const events: KillEvent[] = [];

  for (const line of lines) {
    const event = parseKill(line);

    if (event) {
      events.push(event);
    }
  }

  const groups = new Map<string, KillEvent>();

  for (const event of events) {
    const key = victimBucketKey(event.victim, event.t);
    const currentEvent = groups.get(key);

    if (!currentEvent || typeRank(event.type) > typeRank(currentEvent.type)) {
      groups.set(key, event);
    }
  }

  return groups;
}
