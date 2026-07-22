import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";

describe("playerStats", () => {
  let playerStats;
  let consoleWarnSpy;

  beforeEach(async () => {
    vi.resetModules();
    playerStats = await import("../../../src/features/stats/playerStats.js");

    // Suppress only expected warnings
    const originalWarn = console.warn;
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation((msg) => {
      if (!msg.includes("[mock-parse] WARNING: No connection info for victim")) {
        originalWarn(msg); // Forward other warnings using original console.warn
      }
    });
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    vi.useRealTimers();
  });

  describe("createEmptyStats", () => {
    test("creates default stats for a new player", () => {
      const stats = playerStats.createEmptyStats();
      expect(stats).toEqual({});
    });
  });

  describe("updateStatsFromEvent - PvP events", () => {
    test("increments killer kills and victim deaths after a PvP event", () => {
      const stats = playerStats.createEmptyStats();
      const event = {
        type: "pvp",
        killer: "PlayerA",
        victim: "PlayerB",
        weapon: "M4A1",
        distanceMeters: 50,
      };

      playerStats.updateStatsFromEvent(stats, event);

      expect(stats.PlayerA.kills).toBe(1);
      expect(stats.PlayerB.deaths).toBe(1);
    });

    test("updates current kill streak and resets the victim death streak correctly", () => {
      const stats = playerStats.createEmptyStats();
      const event1 = {
        type: "pvp",
        killer: "Sniper",
        victim: "Runner1",
        weapon: "Mosin",
      };
      const event2 = {
        type: "pvp",
        killer: "Sniper",
        victim: "Runner2",
        weapon: "Mosin",
      };

      playerStats.updateStatsFromEvent(stats, event1);
      expect(stats.Sniper.killStreak).toBe(1);

      playerStats.updateStatsFromEvent(stats, event2);
      expect(stats.Sniper.killStreak).toBe(2);
      expect(stats.Runner2.killStreak).toBe(0);
    });

    test("updates current death streak and resets the killer death streak correctly", () => {
      const stats = playerStats.createEmptyStats();
      const event1 = {
        type: "pvp",
        killer: "Hunter",
        victim: "Prey",
        weapon: "AKM",
      };
      const event2 = {
        type: "pvp",
        killer: "Prey",
        victim: "Hunter",
        weapon: "SKS",
      };

      playerStats.updateStatsFromEvent(stats, event1);
      expect(stats.Prey.deaths).toBe(1); // victim death increments
      expect(stats.Prey.killStreak).toBe(0); // Reset on death
      expect(stats.Hunter.killStreak).toBe(1); // killer streak increments

      playerStats.updateStatsFromEvent(stats, event2);
      expect(stats.Hunter.deaths).toBe(1); // victim death increments
      expect(stats.Hunter.killStreak).toBe(0); // killer streak resets after dying
      expect(stats.Prey.killStreak).toBe(1); // Now has a kill
    });

    test("updates best kill streak only when the current streak exceeds it", () => {
      const stats = playerStats.createEmptyStats();

      // First kill
      playerStats.updateStatsFromEvent(stats, {
        type: "pvp",
        killer: "Rambo",
        victim: "Target1",
        weapon: "M4A1",
      });
      expect(stats.Rambo.killStreak).toBe(1);

      // Second kill - streak reaches 2
      playerStats.updateStatsFromEvent(stats, {
        type: "pvp",
        killer: "Rambo",
        victim: "Target2",
        weapon: "M4A1",
      });
      expect(stats.Rambo.killStreak).toBe(2);

      // Death resets current streak to 0
      playerStats.updateStatsFromEvent(stats, {
        type: "pvp",
        killer: "Avenger",
        victim: "Rambo",
        weapon: "AKM",
      });
      expect(stats.Rambo.killStreak).toBe(0);

      // New kill - current streak restarts at 1
      playerStats.updateStatsFromEvent(stats, {
        type: "pvp",
        killer: "Rambo",
        victim: "Target3",
        weapon: "M4A1",
      });
      expect(stats.Rambo.killStreak).toBe(1);
    });

    test("calculates KD safely when deaths are zero", () => {
      const stats = playerStats.createEmptyStats();
      const event = {
        type: "pvp",
        killer: "FirstBlood",
        victim: "Unlucky",
        weapon: "Pistol",
      };

      playerStats.updateStatsFromEvent(stats, event);

      expect(stats.FirstBlood.kills).toBe(1);
      expect(stats.FirstBlood.deaths).toBe(0);
      expect(stats.FirstBlood.kd).toBe(1.0); // Should handle division by zero
    });

    test("updates longest kill only when the new distance is greater", () => {
      const stats = playerStats.createEmptyStats();

      // First kill at 50m
      playerStats.updateStatsFromEvent(stats, {
        type: "pvp",
        killer: "Sniper",
        victim: "Target1",
        weapon: "Mosin",
        distanceMeters: 50,
      });
      expect(stats.Sniper.longestKill).toBe(50);
      expect(stats.Sniper.longestKillWeapon).toBe("Mosin");

      // Second kill at 100m - should update
      playerStats.updateStatsFromEvent(stats, {
        type: "pvp",
        killer: "Sniper",
        victim: "Target2",
        weapon: "SVD",
        distanceMeters: 100,
      });
      expect(stats.Sniper.longestKill).toBe(100);
      expect(stats.Sniper.longestKillWeapon).toBe("SVD");

      // Third kill at 30m - should NOT update
      playerStats.updateStatsFromEvent(stats, {
        type: "pvp",
        killer: "Sniper",
        victim: "Target3",
        weapon: "M4A1",
        distanceMeters: 30,
      });
      expect(stats.Sniper.longestKill).toBe(100);
      expect(stats.Sniper.longestKillWeapon).toBe("SVD");
    });

    test('stores "Unknown" when a longest-kill weapon is missing', () => {
      const stats = playerStats.createEmptyStats();

      playerStats.updateStatsFromEvent(stats, {
        type: "pvp",
        killer: "Mystery",
        victim: "Target",
        weapon: null,
        distanceMeters: 75,
      });

      expect(stats.Mystery.longestKill).toBe(75);
      expect(stats.Mystery.longestKillWeapon).toBe("Unknown");
    });

    test("preserves an existing longer kill when a shorter kill arrives", () => {
      const stats = playerStats.createEmptyStats();

      // Long kill first
      playerStats.updateStatsFromEvent(stats, {
        type: "pvp",
        killer: "Elite",
        victim: "Far",
        weapon: "Tundra",
        distanceMeters: 200,
      });
      expect(stats.Elite.longestKill).toBe(200);

      // Shorter kill
      playerStats.updateStatsFromEvent(stats, {
        type: "pvp",
        killer: "Elite",
        victim: "Close",
        weapon: "Shotgun",
        distanceMeters: 10,
      });
      expect(stats.Elite.longestKill).toBe(200);
      expect(stats.Elite.longestKillWeapon).toBe("Tundra");
    });
  });

  describe("shared victim death updates", () => {
    test("applies identical victim updates for PvP and explosion deaths", () => {
      const pvpStats = playerStats.createEmptyStats();
      const explosionStats = playerStats.createEmptyStats();

      playerStats.handlePlayerConnect(pvpStats, "Victim", 1000);
      playerStats.handlePlayerConnect(explosionStats, "Victim", 1000);

      for (const stats of [pvpStats, explosionStats]) {
        stats.Victim.kills = 8;
        stats.Victim.deaths = 2;
        stats.Victim.headshots = 3;
        stats.Victim.killStreak = 4;
        stats.Victim.accumulatedAliveMs = 30000;
        stats.Victim.accumulatedPlayedMs = 120000;
      }

      playerStats.updateStatsFromEvent(
        pvpStats,
        {
          type: "pvp",
          killer: "Killer",
          victim: "Victim",
          weapon: "M4A1",
        },
        61000
      );

      playerStats.updateStatsFromEvent(
        explosionStats,
        {
          type: "explosion",
          victim: "Victim",
          device: "Landmine",
        },
        61000
      );

      const victimFields = [
        "deaths",
        "killStreak",
        "kd",
        "score",
        "rank",
        "lastTimeAlive",
        "accumulatedAliveMs",
        "accumulatedPlayedMs",
        "connectedSince",
        "isConnected",
      ];

      for (const field of victimFields) {
        expect(explosionStats.Victim[field]).toEqual(pvpStats.Victim[field]);
      }

      expect(pvpStats.Victim).toMatchObject({
        deaths: 3,
        killStreak: 0,
        kd: 2.67,
        score: 93.7,
        rank: "Private",
        lastTimeAlive: "00H 01M 30S",
        accumulatedAliveMs: 0,
        accumulatedPlayedMs: 180000,
        connectedSince: 61000,
        isConnected: true,
      });
    });
  });

  describe("handlePlayerConnect and handlePlayerDisconnect with mocked time", () => {
    test("handles player connect/disconnect time tracking with mocked time", () => {
      vi.useFakeTimers();
      const stats = playerStats.createEmptyStats();

      // Connect at 1000ms
      playerStats.handlePlayerConnect(stats, "Traveler", 1000);
      expect(stats.Traveler.isConnected).toBe(true);
      expect(stats.Traveler.connectedSince).toBe(1000);

      // Disconnect at 5000ms (4000ms session)
      playerStats.handlePlayerDisconnect(stats, "Traveler", 5000);
      expect(stats.Traveler.isConnected).toBe(false);
      expect(stats.Traveler.connectedSince).toBeNull();
      expect(stats.Traveler.accumulatedAliveMs).toBe(4000);

      vi.useRealTimers();
    });

    test("accumulates alive time correctly across sessions", () => {
      vi.useFakeTimers();
      const stats = playerStats.createEmptyStats();

      // First session: 1000ms to 3000ms (2000ms)
      playerStats.handlePlayerConnect(stats, "SessionTester", 1000);
      playerStats.handlePlayerDisconnect(stats, "SessionTester", 3000);
      expect(stats.SessionTester.accumulatedAliveMs).toBe(2000);

      // Second session: 5000ms to 8000ms (3000ms)
      playerStats.handlePlayerConnect(stats, "SessionTester", 5000);
      playerStats.handlePlayerDisconnect(stats, "SessionTester", 8000);
      expect(stats.SessionTester.accumulatedAliveMs).toBe(5000); // 2000 + 3000

      vi.useRealTimers();
    });
  });

  describe("backward compatibility", () => {
    test("preserves backward compatibility for missing numeric fields using existing defaults", () => {
      const stats = playerStats.createEmptyStats();

      // Simulate old player data without new fields
      stats.OldPlayer = {
        kills: 10,
        deaths: 5,
        headshots: 2,
        kd: 2.0,
        killStreak: 3,
        score: 50,
        rank: "Private",
        // Missing: longestKill, longestKillWeapon, connection tracking fields
      };

      // Update with new event
      playerStats.updateStatsFromEvent(stats, {
        type: "pvp",
        killer: "OldPlayer",
        victim: "NewPlayer",
        weapon: "AK74",
        distanceMeters: 45,
      });

      // Should handle missing longestKill gracefully
      expect(stats.OldPlayer.longestKill).toBe(45);
      expect(stats.OldPlayer.longestKillWeapon).toBe("AK74");
      expect(stats.OldPlayer.kills).toBe(11);
    });
  });

  describe("getPlayerStats", () => {
    test("returns player stats when player exists", () => {
      const stats = playerStats.createEmptyStats();
      playerStats.updateStatsFromEvent(stats, {
        type: "pvp",
        killer: "Existing",
        victim: "Other",
        weapon: "M4A1",
      });

      const result = playerStats.getPlayerStats(stats, "Existing");
      expect(result).not.toBeNull();
      expect(result.kills).toBe(1);
    });

    test("returns null when player does not exist", () => {
      const stats = playerStats.createEmptyStats();
      const result = playerStats.getPlayerStats(stats, "NonExistent");
      expect(result).toBeNull();
    });
  });
});
