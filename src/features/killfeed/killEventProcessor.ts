import { extractAmmo, extractDamage, extractHitZone, parseKill } from "../../parsers/killParser.js";
import type { KillEvent } from "../../types/domainEvents.js";
import { updatePositionsFromLine } from "../tracking/positionTracker.js";
import { typeRank, victimBucketKey } from "./killEventDeduplicator.js";

function enrichPvpFinalHit(event: KillEvent, lines: string[]): KillEvent {
  if (event.type !== "pvp" || !event.victim || !event.killer || !event.t) {
    return event;
  }

  const eventTime = event.t;

  const finalHitLine = lines.find(
    (line) =>
      line.startsWith(eventTime) &&
      line.includes(`Player "${event.victim}" (DEAD)`) &&
      line.includes(`hit by Player "${event.killer}"`) &&
      line.includes("[HP: 0]")
  );

  if (!finalHitLine) {
    return event;
  }

  return {
    ...event,
    ammo: extractAmmo(finalHitLine) ?? event.ammo,
    hitZone: extractHitZone(finalHitLine) ?? event.hitZone,
    damage: extractDamage(finalHitLine) ?? event.damage,
  };
}

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
      groups.set(key, enrichPvpFinalHit(event, lines));
    }
  }

  return groups;
}
