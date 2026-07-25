import { beforeEach, describe, expect, test, vi } from "vitest";
import type { PvPKillEvent } from "../../../src/types/domainEvents.ts";

let persistedState: {
  sentBuckets?: Record<string, number>;
};

let queueKillfeedEvent: ReturnType<typeof vi.fn>;

async function reloadKillfeedModules() {
  vi.resetModules();

  queueKillfeedEvent = vi.fn();

  vi.doMock("../../../src/storage/stateStore.js", () => ({
    loadState: () => persistedState,
    saveState: (nextState: typeof persistedState) => {
      persistedState = structuredClone(nextState);
    },
  }));

  const deduplicator = await import("../../../src/features/killfeed/killEventDeduplicator.ts");

  vi.doMock("../../../src/features/killfeed/killEventDeduplicator.ts", () => deduplicator);

  vi.doMock("../../../src/features/killfeed/killfeedQueue.ts", () => ({
    queueKillfeedEvent,
  }));

  vi.doMock("../../../src/features/tracking/positionTracker.ts", () => ({
    posForVictimFromLine: vi.fn(() => null),
  }));

  return {
    deduplicator,
    handler: await import("../../../src/features/killfeed/killEventHandler.ts"),
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-15T10:00:00.000Z"));

  persistedState = {};
});

describe("persistent kill deduplication", () => {
  test("does not queue the same ADM kill again after a restart and reread", async () => {
    const line =
      '14:23:45 | Player "Killer" (id=1 pos=<100, 100, 100>) killed Player "Victim" (id=2 pos=<200, 200, 200>) with M4A1';

    const kill: PvPKillEvent = {
      type: "pvp",
      killer: "Killer",
      victim: "Victim",
      weapon: "M4A1",
      distanceMeters: null,
      ammo: null,
      hitZone: null,
      damage: null,
      t: "14:23:45",
      line,
    };

    const firstLoad = await reloadKillfeedModules();
    const deduplicator = firstLoad.deduplicator;
    let handler = firstLoad.handler;

    const key = deduplicator.victimBucketKey(kill.victim, kill.t);
    const groups = new Map([[key, kill]]);

    handler.handleKillEvents(groups, [line]);

    expect(queueKillfeedEvent).toHaveBeenCalledTimes(1);

    deduplicator.markSentBucket(key);

    ({ handler } = await reloadKillfeedModules());

    handler.handleKillEvents(groups, [line]);

    expect(queueKillfeedEvent).not.toHaveBeenCalled();
    expect(persistedState.sentBuckets?.[key]).toBe(Date.now());
  });
});
