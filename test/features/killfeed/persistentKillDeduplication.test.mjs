import { createRequire } from "node:module";
import { beforeEach, describe, expect, test, vi } from "vitest";

const require = createRequire(import.meta.url);

const handlerPath = require.resolve("../../../src/features/killfeed/killEventHandler.ts");
const stateStorePath = require.resolve("../../../src/storage/stateStore.js");
const positionTrackerPath = require.resolve("../../../src/features/tracking/positionTracker.ts");

let persistedState;
let queueKillfeedEvent;

function installMocks() {
  const loadState = vi.fn(() => persistedState);
  const saveState = vi.fn((nextState) => {
    persistedState = structuredClone(nextState);
  });

  queueKillfeedEvent = vi.fn();

  require.cache[stateStorePath] = {
    id: stateStorePath,
    filename: stateStorePath,
    loaded: true,
    exports: {
      loadState,
      saveState,
    },
  };

  require.cache[positionTrackerPath] = {
    id: positionTrackerPath,
    filename: positionTrackerPath,
    loaded: true,
    exports: {
      posForVictimFromLine: vi.fn(() => null),
    },
  };
}

async function reloadKillfeedModules() {
  vi.resetModules();

  delete require.cache[handlerPath];

  installMocks();

  vi.doMock("../../../src/storage/stateStore.js", () => ({
    loadState: () => persistedState,
    saveState: (nextState) => {
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

  delete require.cache[handlerPath];
  delete require.cache[stateStorePath];
  delete require.cache[positionTrackerPath];
});

describe("persistent kill deduplication", () => {
  test("does not queue the same ADM kill again after a restart and reread", async () => {
    const line =
      '14:23:45 | Player "Killer" (id=1 pos=<100, 100, 100>) killed Player "Victim" (id=2 pos=<200, 200, 200>) with M4A1';

    const kill = {
      type: "pvp",
      killer: "Killer",
      victim: "Victim",
      weapon: "M4A1",
      t: "14:23:45",
      line,
    };

    let { deduplicator, handler } = await reloadKillfeedModules();

    const key = deduplicator.victimBucketKey(kill.victim, kill.t);
    const groups = new Map([[key, kill]]);

    handler.handleKillEvents(groups, [line]);

    expect(queueKillfeedEvent).toHaveBeenCalledTimes(1);

    deduplicator.markSentBucket(key);

    ({ handler } = await reloadKillfeedModules());

    handler.handleKillEvents(groups, [line]);

    expect(queueKillfeedEvent).not.toHaveBeenCalled();
    expect(persistedState.sentBuckets[key]).toBe(Date.now());
  });
});
