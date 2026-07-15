import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";

describe("killEventDeduplicator", () => {
  let deduplicator;

  beforeEach(async () => {
    // Reset module cache to get fresh sentBuckets Map
    vi.resetModules();
    // Re-import after reset to get fresh module state
    deduplicator =
      await import("../../../src/features/killfeed/killEventDeduplicator.js");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("typeRank", () => {
    test("returns 2 for pvp events", () => {
      expect(deduplicator.typeRank("pvp")).toBe(2);
    });

    test("returns 1 for explosion events", () => {
      expect(deduplicator.typeRank("explosion")).toBe(1);
    });

    test("returns 0 for unknown event types", () => {
      expect(deduplicator.typeRank("unknown")).toBe(0);
      expect(deduplicator.typeRank("suicide")).toBe(0);
      expect(deduplicator.typeRank("")).toBe(0);
      expect(deduplicator.typeRank(null)).toBe(0);
      expect(deduplicator.typeRank(undefined)).toBe(0);
    });
  });

  describe("victimBucketKey", () => {
    test("timestamps inside same 20-second bucket produce same key", () => {
      // 14:23:40 = 51820s → bucket 2591
      // 14:23:59 = 51839s → bucket 2591
      const key1 = deduplicator.victimBucketKey("Victim", "14:23:40");
      const key2 = deduplicator.victimBucketKey("Victim", "14:23:59");
      expect(key1).toBe("Victim|2591");
      expect(key2).toBe("Victim|2591");
      expect(key1).toBe(key2);
    });

    test("timestamps across bucket boundary produce different keys", () => {
      // 14:23:39 = 51819s → bucket 2590
      // 14:23:40 = 51820s → bucket 2591
      const key1 = deduplicator.victimBucketKey("Victim", "14:23:39");
      const key2 = deduplicator.victimBucketKey("Victim", "14:23:40");
      expect(key1).toBe("Victim|2590");
      expect(key2).toBe("Victim|2591");
      expect(key1).not.toBe(key2);
    });

    test("missing timestamp falls back to current mocked time", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-07-15T14:23:45.000Z"));

      const key = deduplicator.victimBucketKey("Victim", null);
      const expectedBucket = Math.floor(Date.now() / 1000 / 20);
      expect(key).toBe(`Victim|${expectedBucket}`);
    });

    test("non-numeric timestamp falls back to current time", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-07-15T10:00:00.000Z"));

      const key = deduplicator.victimBucketKey("Victim", "not:a:time");
      const expectedBucket = Math.floor(Date.now() / 1000 / 20);
      expect(key).toBe(`Victim|${expectedBucket}`);
    });
  });

  describe("alreadySentBucket", () => {
    test("first call returns false", () => {
      const result = deduplicator.alreadySentBucket("Victim1|1000");
      expect(result).toBe(false);
    });

    test("repeated call returns true", () => {
      const key = "Victim2|2000";
      deduplicator.alreadySentBucket(key);
      const result = deduplicator.alreadySentBucket(key);
      expect(result).toBe(true);
    });

    test("different keys remain independent", () => {
      deduplicator.alreadySentBucket("Victim1|1000");
      const result = deduplicator.alreadySentBucket("Victim2|1000");
      expect(result).toBe(false);
    });

    test("key is still present at exactly one hour", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-07-15T10:00:00.000Z"));

      const key = "Victim1|1000";
      deduplicator.alreadySentBucket(key);

      // Advance exactly 1 hour (3600000ms)
      vi.advanceTimersByTime(60 * 60 * 1000);

      // Trigger cleanup with another call
      deduplicator.alreadySentBucket("Victim2|2000");

      // Key should still exist (now - ts = 3600000, not > 3600000)
      expect(deduplicator.alreadySentBucket(key)).toBe(true);
    });

    test("key expires after more than one hour", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-07-15T10:00:00.000Z"));

      const key = "Victim1|1000";
      deduplicator.alreadySentBucket(key);

      // Advance 1 hour + 1ms (3600001ms)
      vi.advanceTimersByTime(60 * 60 * 1000 + 1);

      // Trigger cleanup with another call
      deduplicator.alreadySentBucket("Victim2|2000");

      // Key should be expired and removed (now - ts > 3600000)
      expect(deduplicator.alreadySentBucket(key)).toBe(false);
    });
  });
});
