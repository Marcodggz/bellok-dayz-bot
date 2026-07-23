import { createRequire } from "node:module";
import { beforeEach, describe, expect, test, vi } from "vitest";

const require = createRequire(import.meta.url);

const deduplicatorPath = require.resolve("../../../src/features/killfeed/killEventDeduplicator.js");
const stateStorePath = require.resolve("../../../src/storage/stateStore.js");

let persistedState;
let loadState;
let saveState;

function loadDeduplicator() {
  delete require.cache[deduplicatorPath];

  require.cache[stateStorePath] = {
    id: stateStorePath,
    filename: stateStorePath,
    loaded: true,
    exports: {
      loadState,
      saveState,
    },
  };

  return require(deduplicatorPath);
}

beforeEach(() => {
  vi.useRealTimers();

  persistedState = {};
  loadState = vi.fn(() => persistedState);
  saveState = vi.fn((nextState) => {
    persistedState = structuredClone(nextState);
  });

  delete require.cache[deduplicatorPath];
  delete require.cache[stateStorePath];
});

describe("killEventDeduplicator", () => {
  describe("typeRank", () => {
    test("returns the expected priority for each event type", () => {
      const deduplicator = loadDeduplicator();

      expect(deduplicator.typeRank("pvp")).toBe(2);
      expect(deduplicator.typeRank("explosion")).toBe(1);
      expect(deduplicator.typeRank("unknown")).toBe(0);
      expect(deduplicator.typeRank(null)).toBe(0);
    });
  });

  describe("victimBucketKey", () => {
    test("timestamps inside the same 20-second bucket produce the same key", () => {
      const deduplicator = loadDeduplicator();

      expect(deduplicator.victimBucketKey("Victim", "14:23:40")).toBe("Victim|2591");
      expect(deduplicator.victimBucketKey("Victim", "14:23:59")).toBe("Victim|2591");
    });

    test("timestamps across a bucket boundary produce different keys", () => {
      const deduplicator = loadDeduplicator();

      expect(deduplicator.victimBucketKey("Victim", "14:23:39")).toBe("Victim|2590");
      expect(deduplicator.victimBucketKey("Victim", "14:23:40")).toBe("Victim|2591");
    });

    test("invalid timestamps fall back to the current time", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-07-15T10:00:00.000Z"));

      const deduplicator = loadDeduplicator();
      const expectedBucket = Math.floor(Date.now() / 1000 / 20);

      expect(deduplicator.victimBucketKey("Victim", null)).toBe(`Victim|${expectedBucket}`);
      expect(deduplicator.victimBucketKey("Victim", "not:a:time")).toBe(`Victim|${expectedBucket}`);
    });
  });

  describe("persistent sent buckets", () => {
    test("stores bucket keys with their timestamps", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-07-15T10:00:00.000Z"));

      const deduplicator = loadDeduplicator();

      deduplicator.markSentBucket("Victim|1000");

      expect(persistedState.sentBuckets).toEqual({
        "Victim|1000": Date.now(),
      });
    });

    test("loads a previously sent bucket after a simulated restart", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-07-15T10:00:00.000Z"));

      let deduplicator = loadDeduplicator();
      deduplicator.markSentBucket("Victim|1000");

      delete require.cache[deduplicatorPath];
      deduplicator = loadDeduplicator();

      expect(deduplicator.hasSentBucket("Victim|1000")).toBe(true);
    });

    test("the backward-compatible API reports repeated buckets", () => {
      const deduplicator = loadDeduplicator();

      expect(deduplicator.alreadySentBucket("Victim|1000")).toBe(false);
      expect(deduplicator.alreadySentBucket("Victim|1000")).toBe(true);
    });

    test("removes persisted buckets older than one hour on startup", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-07-15T11:00:00.001Z"));

      persistedState = {
        "/logs/file.adm": {
          size: 123,
          carry: "partial line",
        },
        sentBuckets: {
          "Expired|1000": Date.now() - (60 * 60 * 1000 + 1),
          "Current|1001": Date.now(),
        },
      };

      const deduplicator = loadDeduplicator();

      expect(deduplicator.hasSentBucket("Expired|1000")).toBe(false);
      expect(deduplicator.hasSentBucket("Current|1001")).toBe(true);
      expect(persistedState).toEqual({
        "/logs/file.adm": {
          size: 123,
          carry: "partial line",
        },
        sentBuckets: {
          "Current|1001": Date.now(),
        },
      });
    });

    test("keeps buckets at exactly the one-hour boundary", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-07-15T11:00:00.000Z"));

      persistedState = {
        sentBuckets: {
          "Boundary|1000": Date.now() - 60 * 60 * 1000,
        },
      };

      const deduplicator = loadDeduplicator();

      expect(deduplicator.hasSentBucket("Boundary|1000")).toBe(true);
    });

    test("limits persisted buckets to the 1000 most recent entries", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-07-15T10:00:00.000Z"));

      const baseTimestamp = Date.now() - 1000;
      const entries = {};

      for (let index = 0; index < 1005; index++) {
        entries[`Victim|${index}`] = baseTimestamp + index;
      }

      persistedState = {
        sentBuckets: entries,
      };

      loadDeduplicator();

      const savedEntries = Object.entries(persistedState.sentBuckets);

      expect(savedEntries).toHaveLength(1000);
      expect(persistedState.sentBuckets["Victim|0"]).toBeUndefined();
      expect(persistedState.sentBuckets["Victim|4"]).toBeUndefined();
      expect(persistedState.sentBuckets["Victim|5"]).toBeDefined();
      expect(persistedState.sentBuckets["Victim|1004"]).toBeDefined();
    });

    test("prevents the same ADM kill from being processed after a restart", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-07-15T10:00:00.000Z"));

      let deduplicator = loadDeduplicator();
      const key = deduplicator.victimBucketKey("Victim", "14:23:45");

      expect(deduplicator.hasSentBucket(key)).toBe(false);

      deduplicator.markSentBucket(key);

      delete require.cache[deduplicatorPath];
      deduplicator = loadDeduplicator();

      const rereadKey = deduplicator.victimBucketKey("Victim", "14:23:45");

      expect(rereadKey).toBe(key);
      expect(deduplicator.hasSentBucket(rereadKey)).toBe(true);
      expect(persistedState.sentBuckets[key]).toBe(Date.now());
    });

    test("ignores malformed persisted bucket data", () => {
      persistedState = {
        sentBuckets: ["invalid"],
      };

      const deduplicator = loadDeduplicator();

      expect(deduplicator.hasSentBucket("Victim|1000")).toBe(false);
    });
  });
});
