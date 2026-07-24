// Process raw ADM log lines into deduplicated kill event groups

import { parseKill } from "../../parsers/killParser";
import type { KillEvent } from "../../types/domainEvents";
import { updatePositionsFromLine } from "../tracking/positionTracker";
import { typeRank, victimBucketKey } from "./killEventDeduplicator";

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
