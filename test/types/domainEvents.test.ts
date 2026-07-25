import { describe, expect, test } from "vitest";
import {
  isExplosionKillEvent,
  isPvpKillEvent,
  type ExplosionKillEvent,
  type KillEvent,
  type PvPKillEvent,
} from "../../src/types/domainEvents.ts";

const pvpEvent: PvPKillEvent = {
  type: "pvp",
  killer: "Killer",
  victim: "Victim",
  weapon: "M4A1",
  distanceMeters: 25,
  ammo: "5.56x45mm",
  hitZone: "Torso",
  damage: 85,
  t: "14:23:45",
  line: "PvP line",
};

const explosionEvent: ExplosionKillEvent = {
  type: "explosion",
  victim: "Victim",
  device: "Landmine explosion",
  t: "14:23:45",
  line: "Explosion line",
};

describe("domain event type guards", () => {
  test("identifies and narrows PvP kill events", () => {
    const event: KillEvent = pvpEvent;

    expect(isPvpKillEvent(event)).toBe(true);
    expect(isExplosionKillEvent(event)).toBe(false);

    if (!isPvpKillEvent(event)) {
      throw new Error("Expected a PvP kill event");
    }

    expect(event.weapon).toBe("M4A1");
    expect(event.killer).toBe("Killer");
  });

  test("identifies and narrows explosion kill events", () => {
    const event: KillEvent = explosionEvent;

    expect(isExplosionKillEvent(event)).toBe(true);
    expect(isPvpKillEvent(event)).toBe(false);

    if (!isExplosionKillEvent(event)) {
      throw new Error("Expected an explosion kill event");
    }

    expect(event.device).toBe("Landmine explosion");
  });

  test("filters a discriminated union by event type", () => {
    const events: KillEvent[] = [pvpEvent, explosionEvent];

    const pvpEvents = events.filter(isPvpKillEvent);
    const explosionEvents = events.filter(isExplosionKillEvent);

    expect(pvpEvents).toHaveLength(1);
    expect(pvpEvents[0].weapon).toBe("M4A1");

    expect(explosionEvents).toHaveLength(1);
    expect(explosionEvents[0].device).toBe("Landmine explosion");
  });
});
