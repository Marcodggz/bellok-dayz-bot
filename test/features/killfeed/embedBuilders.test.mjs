import { describe, test, expect } from "vitest";
import { embedPvp, embedExplosion } from "../../../src/features/killfeed/embedBuilders.js";

describe("embedBuilders", () => {
  describe("embedPvp", () => {
    test("shows zero values and Unranked when stats are missing", () => {
      const killEvent = {
        killer: "TestKiller",
        victim: "TestVictim",
        weapon: "M4A1",
        distanceMeters: 50,
        t: "14:23:45",
      };

      const result = embedPvp(killEvent, null, null, null);

      const description = result.embeds[0].data.description;

      // Killer stats should show zeros and Unranked
      expect(description).toContain("__**Killer:**__ `TestKiller`");
      expect(description).toContain("**Rank:** Unranked | **Score:** 0");
      expect(description).toContain("**Kills:** 0 | **Deaths:** 0 | **KD:** 0.00");
      expect(description).toContain("**Kill Streak:** 0");

      // Victim stats should show zeros and Unranked
      expect(description).toContain("__**Victim:**__ `TestVictim`");
      expect(description).toContain("**Rank:** Unranked | **Score:** 0");
      expect(description).toContain("**Kills:** 0 | **Deaths:** 0 | **KD:** 0.00");
      expect(description).toContain("**Time Alive:** 0m");
    });

    test("sanitizes backticks in killer and victim names", () => {
      const killEvent = {
        killer: "Test`Killer",
        victim: "Test`Victim",
        weapon: "M4A1",
        distanceMeters: 50,
        t: "14:23:45",
      };

      const result = embedPvp(killEvent, null, null, null);
      const description = result.embeds[0].data.description;

      expect(description).toContain("`Test'Killer`");
      expect(description).toContain("`Test'Victim`");
      expect(description).not.toContain("Test`Killer");
      expect(description).not.toContain("Test`Victim");
    });

    test("shows weapon and ammo using the PvP killfeed structure", () => {
      const killEvent = {
        killer: "Aizenn-7",
        victim: "mrboderlandsfn-_",
        weapon: "M70 Tundra",
        ammo: "Bullet_308Win",
        distanceMeters: 72.17,
        hitZone: "Torso",
        damage: 146,
        victimPosition: { x: 3276.3, y: 5142.0, z: 398.1 },
        t: "17:07:55",
      };

      const result = embedPvp(killEvent, null, null, null);
      const description = result.embeds[0].data.description;

      expect(description).toContain("### PVP Kill - 17:07:55");
      expect(description).toContain("**Weapon** M70 Tundra (Bullet_308Win)");
      expect(description).toContain("**Distance** 72 meters");
      expect(description).toContain("**Hit** Torso 146 damage");
      expect(description).toContain("**Location** [3276.3;5142.0;398.1]");
      expect(description).toContain("__**Killer:**__ `Aizenn-7`");
      expect(description).toContain("__**Victim:**__ `mrboderlandsfn-_`");
    });

    test("shows melee weapons without empty ammo parentheses", () => {
      const killEvent = {
        killer: "TestKiller",
        victim: "TestVictim",
        weapon: "Combat Knife",
        ammo: null,
        distanceMeters: 1.2,
        hitZone: "Torso",
        damage: 35,
        t: "17:07:55",
      };

      const result = embedPvp(killEvent, null, null, null);
      const description = result.embeds[0].data.description;

      expect(description).toContain("**Weapon** Combat Knife");
      expect(description).not.toContain("Combat Knife ()");
      expect(description).not.toContain("Combat Knife (N/A)");
    });

    test("shows provided stats when available", () => {
      const killEvent = {
        killer: "TestKiller",
        victim: "TestVictim",
        weapon: "M4A1",
        distanceMeters: 50,
        t: "14:23:45",
      };

      const killerStats = {
        rank: "Corporal",
        score: 150.5,
        kills: 10,
        deaths: 2,
        kd: 5.0,
        killStreak: 3,
      };

      const victimStats = {
        rank: "Private",
        score: 75.2,
        kills: 5,
        deaths: 8,
        kd: 0.625,
        lastTimeAlive: "15m 30s",
      };

      const result = embedPvp(killEvent, null, killerStats, victimStats);

      const description = result.embeds[0].data.description;

      // Killer stats
      expect(description).toContain("**Rank:** Corporal | **Score:** 150.5");
      expect(description).toContain("**Kills:** 10 | **Deaths:** 2 | **KD:** 5.00");
      expect(description).toContain("**Kill Streak:** 3");

      // Victim stats
      expect(description).toContain("**Rank:** Private | **Score:** 75.2");
      expect(description).toContain("**Kills:** 5 | **Deaths:** 8 | **KD:** 0.63");
      expect(description).toContain("**Time Alive:** 15m 30s");
    });

    test("uses X and Y coordinates for location display", () => {
      const killEvent = {
        killer: "TestKiller",
        victim: "TestVictim",
        weapon: "M4A1",
        victimPosition: { x: 13044.9, y: 7786.9, z: 250.5 },
        t: "14:23:45",
      };

      const result = embedPvp(killEvent, null, null, null);

      const description = result.embeds[0].data.description;

      // Should show coordinates as X;Y;Z format and link with X,Y
      expect(description).toContain("13044.9;7786.9;250.5");
      expect(description).toContain("https://www.izurvive.com/livonia/#location=13044.9;7786.9");
    });

    test("handles partially populated killer stats without showing undefined or NaN", () => {
      const killEvent = {
        killer: "TestKiller",
        victim: "TestVictim",
        weapon: "M4A1",
        t: "14:23:45",
      };

      const killerStats = {
        kills: 5,
        // Missing: rank, score, deaths, kd, killStreak
      };

      const result = embedPvp(killEvent, null, killerStats, null);

      const description = result.embeds[0].data.description;

      // Should use fallback values for missing fields
      expect(description).toContain("__**Killer:**__ `TestKiller`");
      expect(description).toContain("**Rank:** Unranked | **Score:** 0.0");
      expect(description).toContain("**Kills:** 5 | **Deaths:** 0 | **KD:** 0.00");
      expect(description).toContain("**Kill Streak:** 0");

      // Should not contain undefined or NaN
      expect(description).not.toContain("undefined");
      expect(description).not.toContain("NaN");
    });

    test("handles partially populated victim stats without showing undefined or NaN", () => {
      const killEvent = {
        killer: "TestKiller",
        victim: "TestVictim",
        weapon: "M4A1",
        t: "14:23:45",
      };

      const victimStats = {
        rank: "Private",
        kills: 3,
        deaths: 7,
        // Missing: score, kd, lastTimeAlive
      };

      const result = embedPvp(killEvent, null, null, victimStats);

      const description = result.embeds[0].data.description;

      // Should use fallback values for missing fields
      expect(description).toContain("__**Victim:**__ `TestVictim`");
      expect(description).toContain("**Rank:** Private | **Score:** 0.0");
      expect(description).toContain("**Kills:** 3 | **Deaths:** 7 | **KD:** 0.00");
      expect(description).toContain("**Time Alive:** 0m");

      // Should not contain undefined or NaN
      expect(description).not.toContain("undefined");
      expect(description).not.toContain("NaN");
    });

    test("handles stats with missing kd field specifically", () => {
      const killEvent = {
        killer: "TestKiller",
        victim: "TestVictim",
        weapon: "M4A1",
        t: "14:23:45",
      };

      const killerStats = {
        rank: "Specialist",
        score: 100,
        kills: 10,
        deaths: 5,
        killStreak: 2,
        // Missing: kd (which could be calculated but might be missing)
      };

      const result = embedPvp(killEvent, null, killerStats, null);

      const description = result.embeds[0].data.description;

      // Should show 0.00 for missing kd, not NaN
      expect(description).toContain("**KD:** 0.00");
      expect(description).not.toContain("NaN");
    });
  });

  describe("embedExplosion", () => {
    test("shows zero values and Unranked when victim stats are missing", () => {
      const killEvent = {
        victim: "TestVictim",
        device: "Landmine",
        t: "14:23:45",
      };

      const result = embedExplosion(killEvent, null, null);

      const description = result.embeds[0].data.description;

      // Victim stats should show zeros and Unranked
      expect(description).toContain("__**Victim:**__ `TestVictim`");
      expect(description).toContain("**Rank:** Unranked | **Score:** 0");
      expect(description).toContain("**Kills:** 0 | **Deaths:** 0 | **KD:** 0.00");
      expect(description).toContain("**Time Alive:** 0m");
    });

    test("sanitizes backticks in victim names", () => {
      const killEvent = {
        victim: "Test`Victim",
        device: "Landmine",
        t: "14:23:45",
      };

      const result = embedExplosion(killEvent, null, null);
      const description = result.embeds[0].data.description;

      expect(description).toContain("`Test'Victim`");
      expect(description).not.toContain("Test`Victim");
    });

    test("shows provided victim stats when available", () => {
      const killEvent = {
        victim: "TestVictim",
        device: "Grenade",
        t: "14:23:45",
      };

      const victimStats = {
        rank: "Private",
        score: 75.2,
        kills: 5,
        deaths: 8,
        kd: 0.625,
        lastTimeAlive: "15m 30s",
      };

      const result = embedExplosion(killEvent, null, victimStats);

      const description = result.embeds[0].data.description;

      expect(description).toContain("**Rank:** Private | **Score:** 75.2");
      expect(description).toContain("**Kills:** 5 | **Deaths:** 8 | **KD:** 0.63");
      expect(description).toContain("**Time Alive:** 15m 30s");
    });

    test("uses X and Y coordinates for location display", () => {
      const killEvent = {
        victim: "TestVictim",
        device: "Landmine",
        victimPosition: { x: 13044.9, y: 7786.9, z: 250.5 },
        t: "14:23:45",
      };

      const result = embedExplosion(killEvent, null, null);

      const description = result.embeds[0].data.description;

      // Should show coordinates as X;Y;Z format and link with X,Y
      expect(description).toContain("13044.9;7786.9;250.5");
      expect(description).toContain("https://www.izurvive.com/livonia/#location=13044.9;7786.9");
    });

    test("handles partially populated victim stats without showing undefined or NaN", () => {
      const killEvent = {
        victim: "TestVictim",
        device: "Grenade",
        t: "14:23:45",
      };

      const victimStats = {
        score: 50.5,
        kills: 2,
        // Missing: rank, deaths, kd, lastTimeAlive
      };

      const result = embedExplosion(killEvent, null, victimStats);

      const description = result.embeds[0].data.description;

      // Should use fallback values for missing fields
      expect(description).toContain("__**Victim:**__ `TestVictim`");
      expect(description).toContain("**Rank:** Unranked | **Score:** 50.5");
      expect(description).toContain("**Kills:** 2 | **Deaths:** 0 | **KD:** 0.00");
      expect(description).toContain("**Time Alive:** 0m");

      // Should not contain undefined or NaN
      expect(description).not.toContain("undefined");
      expect(description).not.toContain("NaN");
    });

    test("handles missing lastTimeAlive field specifically", () => {
      const killEvent = {
        victim: "TestVictim",
        device: "Landmine",
        t: "14:23:45",
      };

      const victimStats = {
        rank: "Private",
        score: 100,
        kills: 8,
        deaths: 5,
        kd: 1.6,
        // Missing: lastTimeAlive
      };

      const result = embedExplosion(killEvent, null, victimStats);

      const description = result.embeds[0].data.description;

      // Should show "0m" for missing lastTimeAlive
      expect(description).toContain("**Time Alive:** 0m");
      expect(description).not.toContain("undefined");
    });
  });
});
