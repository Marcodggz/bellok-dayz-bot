import { createRequire } from "node:module";
import { describe, test, expect, beforeEach, vi } from "vitest";

const require = createRequire(import.meta.url);

const processorPath = require.resolve("../../../src/features/killfeed/killEventProcessor.ts");
const trackerPath = require.resolve("../../../src/features/tracking/positionTracker.js");
const weekendHelpersPath = require.resolve("../../../src/utils/weekendHeatmapHelpers.js");

describe("killEventProcessor", () => {
  let processor;

  beforeEach(async () => {
    vi.resetModules();

    delete require.cache[processorPath];
    delete require.cache[trackerPath];
    delete require.cache[weekendHelpersPath];

    require.cache[weekendHelpersPath] = {
      id: weekendHelpersPath,
      filename: weekendHelpersPath,
      loaded: true,
      exports: {
        addWeekendHeatPoint: vi.fn(),
      },
    };

    // Suppress only dotenv console output
    const originalConsoleLog = console.log;
    const spy = vi.spyOn(console, "log").mockImplementation((...args) => {
      const msg = args.join(" ");
      if (!msg.includes("dotenv")) {
        originalConsoleLog(...args);
      }
    });

    try {
      processor = await import("../../../src/features/killfeed/killEventProcessor.ts");
    } finally {
      spy.mockRestore();
    }
  });

  describe("processKillEvents", () => {
    test("parses valid kill lines and updates positions", () => {
      const lines = [
        '14:23:45 | Player "Survivor1" (id=12345678 pos=<7234.5, 5678.2, 302.1>) killed Player "Victim1" (id=87654321 pos=<7230.1, 5680.5, 301.8>) with M4A1 from 15.2 meters',
      ];

      const result = processor.processKillEvents(lines);

      // Should parse the kill event correctly
      expect(result.size).toBe(1);
      const event = Array.from(result.values())[0];
      expect(event.type).toBe("pvp");
      expect(event.killer).toBe("Survivor1");
      expect(event.victim).toBe("Victim1");
      expect(event.weapon).toBe("M4A1");
    });

    test("ignores unrelated lines", () => {
      const lines = [
        "14:32:18 | ##### PlayerList log: 12 players online",
        '14:38:20 | Player "NewPlayer" (id=88776655) is connected (ping: 45ms)',
        '14:43:12 | Player "Disconnected" (id=99001122) has been disconnected',
        "Some random log message",
      ];

      const result = processor.processKillEvents(lines);

      expect(result.size).toBe(0);
    });

    test("groups events by victim bucket key", () => {
      const lines = [
        // Both kills at 14:23:XX -> same bucket (2591)
        '14:23:45 | Player "Killer1" (id=12345678 pos=<7234.5, 5678.2, 302.1>) killed Player "Victim1" (id=87654321 pos=<7230.1, 5680.5, 301.8>) with M4A1 from 15.2 meters',
        '14:23:50 | Player "Killer2" (id=12345678 pos=<7234.5, 5678.2, 302.1>) killed Player "Victim1" (id=87654321 pos=<7230.1, 5680.5, 301.8>) with AKM from 15.2 meters',
      ];

      const result = processor.processKillEvents(lines);

      // Should have only 1 entry for Victim1 in bucket 2591
      expect(result.size).toBe(1);
    });

    test("keeps one event per victim bucket", () => {
      const lines = [
        // Three kills of same victim in same bucket
        '14:23:40 | Player "Killer1" (id=1 pos=<100, 100, 100>) killed Player "Victim1" (id=2 pos=<200, 200, 200>) with M4A1',
        '14:23:45 | Player "Killer2" (id=3 pos=<100, 100, 100>) killed Player "Victim1" (id=2 pos=<200, 200, 200>) with AKM',
        '14:23:59 | Player "Killer3" (id=4 pos=<100, 100, 100>) killed Player "Victim1" (id=2 pos=<200, 200, 200>) with Mosin',
      ];

      const result = processor.processKillEvents(lines);

      // Should keep only one event
      expect(result.size).toBe(1);
      const event = Array.from(result.values())[0];
      expect(event.victim).toBe("Victim1");
    });

    test("prefers PvP over explosion when both belong to same victim bucket", () => {
      const lines = [
        // Explosion first
        '14:23:40 | Player "Victim1" (id=55443322 pos=<4521.8, 9876.5, 125.3>) killed by Grenade explosion',
        // Then PvP in same bucket
        '14:23:50 | Player "Killer1" (id=12345678 pos=<7234.5, 5678.2, 302.1>) killed Player "Victim1" (id=87654321 pos=<7230.1, 5680.5, 301.8>) with M4A1',
      ];

      const result = processor.processKillEvents(lines);

      expect(result.size).toBe(1);
      const event = Array.from(result.values())[0];
      expect(event.type).toBe("pvp");
      expect(event.killer).toBe("Killer1");
      expect(event.weapon).toBe("M4A1");
    });

    test("keeps explosion when no PvP event exists", () => {
      const lines = [
        '14:27:33 | Player "BoomGuy" (id=55443322 pos=<4521.8, 9876.5, 125.3>) killed by Grenade explosion',
      ];

      const result = processor.processKillEvents(lines);

      expect(result.size).toBe(1);
      const event = Array.from(result.values())[0];
      expect(event.type).toBe("explosion");
      expect(event.victim).toBe("BoomGuy");
      expect(event.device).toBe("Grenade explosion");
    });

    test("returns empty collection for empty input", () => {
      const result = processor.processKillEvents([]);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });

    test("preserves separate groups for different victims", () => {
      const lines = [
        // Same time bucket, different victims
        '14:23:45 | Player "Killer1" (id=1 pos=<100, 100, 100>) killed Player "Victim1" (id=2 pos=<200, 200, 200>) with M4A1',
        '14:23:46 | Player "Killer2" (id=3 pos=<100, 100, 100>) killed Player "Victim2" (id=4 pos=<200, 200, 200>) with AKM',
        '14:23:47 | Player "Killer3" (id=5 pos=<100, 100, 100>) killed Player "Victim3" (id=6 pos=<200, 200, 200>) with Mosin',
      ];

      const result = processor.processKillEvents(lines);

      // Should have 3 separate groups
      expect(result.size).toBe(3);

      const events = Array.from(result.values());
      const victims = events.map((e) => e.victim).sort();
      expect(victims).toEqual(["Victim1", "Victim2", "Victim3"]);
    });

    test("preserves separate groups for different time buckets", () => {
      const lines = [
        // Same victim, different buckets (14:23:39 = bucket 2590, 14:23:40 = bucket 2591)
        '14:23:39 | Player "Killer1" (id=1 pos=<100, 100, 100>) killed Player "Victim1" (id=2 pos=<200, 200, 200>) with M4A1',
        '14:23:40 | Player "Killer2" (id=3 pos=<100, 100, 100>) killed Player "Victim1" (id=2 pos=<200, 200, 200>) with AKM',
      ];

      const result = processor.processKillEvents(lines);

      // Should have 2 separate groups (different buckets)
      expect(result.size).toBe(2);

      const events = Array.from(result.values());
      expect(events[0].weapon).toBe("M4A1");
      expect(events[1].weapon).toBe("AKM");
    });

    test("handles mixed kill types and priorities correctly", () => {
      const lines = [
        // Victim1: PvP in bucket 2591
        '14:23:45 | Player "Killer1" (id=1 pos=<100, 100, 100>) killed Player "Victim1" (id=2 pos=<200, 200, 200>) with M4A1',
        // Victim2: Explosion in bucket 2591
        '14:23:46 | Player "Victim2" (id=4 pos=<200, 200, 200>) killed by Grenade explosion',
        // Victim2: PvP in same bucket (should override explosion)
        '14:23:50 | Player "Killer2" (id=3 pos=<100, 100, 100>) killed Player "Victim2" (id=4 pos=<200, 200, 200>) with AKM',
        // Victim3: Only explosion
        '14:23:55 | Player "Victim3" (id=5 pos=<200, 200, 200>) killed by Landmine explosion',
      ];

      const result = processor.processKillEvents(lines);

      expect(result.size).toBe(3);

      const events = Array.from(result.values());

      // Victim1: PvP
      const victim1Event = events.find((e) => e.victim === "Victim1");
      expect(victim1Event.type).toBe("pvp");
      expect(victim1Event.weapon).toBe("M4A1");

      // Victim2: PvP (explosion overridden)
      const victim2Event = events.find((e) => e.victim === "Victim2");
      expect(victim2Event.type).toBe("pvp");
      expect(victim2Event.weapon).toBe("AKM");

      // Victim3: Explosion
      const victim3Event = events.find((e) => e.victim === "Victim3");
      expect(victim3Event.type).toBe("explosion");
      expect(victim3Event.device).toBe("Landmine explosion");
    });
  });
});
