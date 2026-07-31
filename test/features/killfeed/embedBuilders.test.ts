import { afterEach, describe, expect, test, vi } from "vitest";
import type {
  ExplosionKillEvent,
  PlayerStats,
  PvPKillEvent,
} from "../../../src/types/domainEvents.ts";
import {
  buildLocationLine,
  buildVictimStatsLines,
  embedPvp,
  embedExplosion,
  getExplosionDeathPhrase,
  getRandomPvpAction,
} from "../../../src/features/killfeed/embedBuilders.ts";

function createPvpEvent(overrides: Partial<PvPKillEvent> = {}): PvPKillEvent {
  return {
    type: "pvp",
    killer: "TestKiller",
    victim: "TestVictim",
    weapon: "M4A1",
    distanceMeters: null,
    ammo: null,
    hitZone: null,
    damage: null,
    t: "14:23:45",
    line: "test PvP line",
    ...overrides,
  };
}

function createExplosionEvent(overrides: Partial<ExplosionKillEvent> = {}): ExplosionKillEvent {
  return {
    type: "explosion",
    victim: "TestVictim",
    device: "Landmine",
    t: "14:23:45",
    line: "test explosion line",
    ...overrides,
  };
}

describe("embedBuilders", () => {
  describe("shared presentation helpers", () => {
    test("builds the linked location line used by both embed types", () => {
      expect(buildLocationLine({ x: 13044.9, y: 7786.9, z: 250.5 })).toBe(
        "**Location** [13044.9;7786.9;250.5](https://www.izurvive.com/livonia/#location=13044.9;7786.9;8)"
      );
    });

    test("returns the existing location fallback when coordinates are unavailable", () => {
      expect(buildLocationLine(null)).toBe("**Location** N/A");
    });

    test("builds the victim statistics lines with the existing visual format", () => {
      expect(
        buildVictimStatsLines("TestVictim", {
          rank: "Private",
          score: 75.2,
          kills: 5,
          deaths: 8,
          kd: 0.625,
          lastTimeAlive: "15m 30s",
        })
      ).toEqual([
        "__**Victim:**__ `TestVictim`",
        "**Rank:** Private | **Score:** 75.2",
        "**Kills:** 5 | **Deaths:** 8 | **KD:** 0.63",
        "**Time Alive:** 15m 30s",
      ]);
    });

    test("uses the existing victim statistics fallbacks", () => {
      expect(buildVictimStatsLines("TestVictim", null)).toEqual([
        "__**Victim:**__ `TestVictim`",
        "**Rank:** Unranked | **Score:** 0.0",
        "**Kills:** 0 | **Deaths:** 0 | **KD:** 0.00",
        "**Time Alive:** 0m",
      ]);
    });
  });

  test("uses the supported PvP action phrases", () => {
    const supportedActions = [
      "embarrassed",
      "eliminated",
      "shit on",
      "destroyed",
      "wrecked",
      "ended",
      "smoked",
      "annihilated",
    ];

    const actions = Array.from({ length: 40 }, (_, index) =>
      getRandomPvpAction("K".repeat(index), "V".repeat(index * 2))
    );

    expect(actions.every((action) => supportedActions.includes(action))).toBe(true);

    for (const action of supportedActions) {
      expect(actions).toContain(action);
    }
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("uses the death time in the title and the Discord send time in the footer", () => {
    const deathTimestamp = Date.parse("2026-07-28T16:00:08.000Z");
    const sentTimestamp = Date.parse("2026-07-28T16:08:00.000Z");

    vi.useFakeTimers();
    vi.setSystemTime(sentTimestamp);

    const pvpResult = embedPvp(createPvpEvent(), deathTimestamp, null, null);
    const explosionResult = embedExplosion(createExplosionEvent(), deathTimestamp, null);

    const expectedDeathTime = `<t:${Math.floor(deathTimestamp / 1000)}:T>`;
    const expectedSendTime = new Date(sentTimestamp).toISOString();

    expect(pvpResult.embeds[0].data.description).toContain(expectedDeathTime);
    expect(explosionResult.embeds[0].data.description).toContain(expectedDeathTime);

    expect(pvpResult.embeds[0].data.timestamp).toBe(expectedSendTime);
    expect(explosionResult.embeds[0].data.timestamp).toBe(expectedSendTime);
  });

  describe("embedPvp", () => {
    test("shows zero values and Unranked when stats are missing", () => {
      const killEvent = createPvpEvent({
        killer: "TestKiller",
        victim: "TestVictim",
        weapon: "M4A1",
        distanceMeters: 50,
        t: "14:23:45",
      });

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
      const killEvent = createPvpEvent({
        killer: "Test`Killer",
        victim: "Test`Victim",
        weapon: "M4A1",
        distanceMeters: 50,
        t: "14:23:45",
      });

      const result = embedPvp(killEvent, null, null, null);
      const description = result.embeds[0].data.description;

      expect(description).toContain("`Test'Killer`");
      expect(description).toContain("`Test'Victim`");
      expect(description).not.toContain("Test`Killer");
      expect(description).not.toContain("Test`Victim");
    });

    test("shows weapon and ammo using the PvP killfeed structure", () => {
      const killEvent = createPvpEvent({
        killer: "Aizenn-7",
        victim: "mrboderlandsfn-_",
        weapon: "M70 Tundra",
        ammo: "Bullet_308Win",
        distanceMeters: 72.17,
        hitZone: "Torso",
        damage: 146,
        victimPosition: { x: 3276.3, y: 5142.0, z: 398.1 },
        t: "17:07:55",
      });

      const result = embedPvp(killEvent, null, null, null);
      const description = result.embeds[0].data.description;

      expect(description).toContain("### PVP Kill - 17:07:55");
      expect(description).toContain("**Weapon** M70 Tundra (Bullet_308Win)");
      expect(description).toContain("**Distance** 72.17 meters");
      expect(description).toContain("**Hit** Torso 146 damage");
      expect(description).toContain("**Location** [3276.3;5142.0;398.1]");
      expect(description).toContain("__**Killer:**__ `Aizenn-7`");
      expect(description).toContain("__**Victim:**__ `mrboderlandsfn-_`");
    });

    test("shows melee weapons without empty ammo parentheses", () => {
      const killEvent = createPvpEvent({
        killer: "TestKiller",
        victim: "TestVictim",
        weapon: "Combat Knife",
        ammo: null,
        distanceMeters: 1.2,
        hitZone: "Torso",
        damage: 35,
        t: "17:07:55",
      });

      const result = embedPvp(killEvent, null, null, null);
      const description = result.embeds[0].data.description;

      expect(description).toContain("**Weapon** Combat Knife");
      expect(description).not.toContain("Combat Knife ()");
      expect(description).not.toContain("Combat Knife (N/A)");
    });

    test("shows provided stats when available", () => {
      const killEvent = createPvpEvent({
        killer: "TestKiller",
        victim: "TestVictim",
        weapon: "M4A1",
        distanceMeters: 50,
        t: "14:23:45",
      });

      const killerStats = {
        rank: "Corporal",
        score: 150.5,
        kills: 10,
        deaths: 2,
        kd: 5.0,
        killStreak: 3,
      } satisfies Partial<PlayerStats>;

      const victimStats = {
        rank: "Private",
        score: 75.2,
        kills: 5,
        deaths: 8,
        kd: 0.625,
        lastTimeAlive: "15m 30s",
      } satisfies Partial<PlayerStats>;

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
      const killEvent = createPvpEvent({
        killer: "TestKiller",
        victim: "TestVictim",
        weapon: "M4A1",
        victimPosition: { x: 13044.9, y: 7786.9, z: 250.5 },
        t: "14:23:45",
      });

      const result = embedPvp(killEvent, null, null, null);

      const description = result.embeds[0].data.description;

      // Should show coordinates as X;Y;Z format and link with X,Y
      expect(description).toContain("13044.9;7786.9;250.5");
      expect(description).toContain("https://www.izurvive.com/livonia/#location=13044.9;7786.9");
    });

    test("handles partially populated killer stats without showing undefined or NaN", () => {
      const killEvent = createPvpEvent({
        killer: "TestKiller",
        victim: "TestVictim",
        weapon: "M4A1",
        t: "14:23:45",
      });

      const killerStats = {
        kills: 5,
        // Missing: rank, score, deaths, kd, killStreak
      } satisfies Partial<PlayerStats>;

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
      const killEvent = createPvpEvent({
        killer: "TestKiller",
        victim: "TestVictim",
        weapon: "M4A1",
        t: "14:23:45",
      });

      const victimStats = {
        rank: "Private",
        kills: 3,
        deaths: 7,
        // Missing: score, kd, lastTimeAlive
      } satisfies Partial<PlayerStats>;

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
      const killEvent = createPvpEvent({
        killer: "TestKiller",
        victim: "TestVictim",
        weapon: "M4A1",
        t: "14:23:45",
      });

      const killerStats = {
        rank: "Specialist",
        score: 100,
        kills: 10,
        deaths: 5,
        killStreak: 2,
        // Missing: kd (which could be calculated but might be missing)
      } satisfies Partial<PlayerStats>;

      const result = embedPvp(killEvent, null, killerStats, null);

      const description = result.embeds[0].data.description;

      // Should show 0.00 for missing kd, not NaN
      expect(description).toContain("**KD:** 0.00");
      expect(description).not.toContain("NaN");
    });
  });

  describe("getExplosionDeathPhrase", () => {
    test.each([
      ["LandMineExplosion", "died from a land mine"],
      ["LandMineTrap", "died from a land mine"],
      ["Plastic_Explosive_Ammo", "died from a plastic explosive"],
      ["Plastic Explosive", "died from a plastic explosive"],
      ["ClaymoreMine_Ammo", "died from a claymore"],
      ["Claymore", "died from a claymore"],
      ["RGD5Grenade_Ammo", "died from a grenade"],
      ["EGD-5 Frag Grenade", "died from a grenade"],
      ["M67Grenade_Ammo", "died from a grenade"],
      ["6-M7 Frag Grenade", "died from a grenade"],
    ])("maps %s to a readable death phrase", (device, expected) => {
      expect(getExplosionDeathPhrase(device)).toBe(expected);
    });

    test("uses a readable fallback for an unknown explosive", () => {
      expect(getExplosionDeathPhrase("UnknownExplosive_Ammo")).toBe(
        "died in an explosion caused by UnknownExplosive_Ammo"
      );
    });

    test("uses a generic fallback when the device is missing", () => {
      expect(getExplosionDeathPhrase(null)).toBe("died in an explosion");
    });
  });

  describe("embedExplosion", () => {
    test.each([
      ["LandMineExplosion", "`TestVictim` died from a land mine"],
      ["Plastic_Explosive_Ammo", "`TestVictim` died from a plastic explosive"],
      ["ClaymoreMine_Ammo", "`TestVictim` died from a claymore"],
      ["RGD5Grenade_Ammo", "`TestVictim` died from a grenade"],
      ["M67Grenade_Ammo", "`TestVictim` died from a grenade"],
    ])("shows a readable cause for %s", (device, expected) => {
      const result = embedExplosion(
        createExplosionEvent({
          victim: "TestVictim",
          device,
        }),
        null,
        null
      );

      const description = result.embeds[0].data.description;

      expect(description).toContain(expected);
      expect(description).not.toContain(`"${device}" explosion`);
    });

    test("shows zero values and Unranked when victim stats are missing", () => {
      const killEvent = createExplosionEvent({
        victim: "TestVictim",
        device: "Landmine",
        t: "14:23:45",
      });

      const result = embedExplosion(killEvent, null, null);

      const description = result.embeds[0].data.description;

      // Victim stats should show zeros and Unranked
      expect(description).toContain("__**Victim:**__ `TestVictim`");
      expect(description).toContain("**Rank:** Unranked | **Score:** 0");
      expect(description).toContain("**Kills:** 0 | **Deaths:** 0 | **KD:** 0.00");
      expect(description).toContain("**Time Alive:** 0m");
    });

    test("sanitizes backticks in victim names", () => {
      const killEvent = createExplosionEvent({
        victim: "Test`Victim",
        device: "Landmine",
        t: "14:23:45",
      });

      const result = embedExplosion(killEvent, null, null);
      const description = result.embeds[0].data.description;

      expect(description).toContain("`Test'Victim`");
      expect(description).not.toContain("Test`Victim");
    });

    test("shows provided victim stats when available", () => {
      const killEvent = createExplosionEvent({
        victim: "TestVictim",
        device: "Grenade",
        t: "14:23:45",
      });

      const victimStats = {
        rank: "Private",
        score: 75.2,
        kills: 5,
        deaths: 8,
        kd: 0.625,
        lastTimeAlive: "15m 30s",
      } satisfies Partial<PlayerStats>;

      const result = embedExplosion(killEvent, null, victimStats);

      const description = result.embeds[0].data.description;

      expect(description).toContain("**Rank:** Private | **Score:** 75.2");
      expect(description).toContain("**Kills:** 5 | **Deaths:** 8 | **KD:** 0.63");
      expect(description).toContain("**Time Alive:** 15m 30s");
    });

    test("uses X and Y coordinates for location display", () => {
      const killEvent = createExplosionEvent({
        victim: "TestVictim",
        device: "Landmine",
        victimPosition: { x: 13044.9, y: 7786.9, z: 250.5 },
        t: "14:23:45",
      });

      const result = embedExplosion(killEvent, null, null);

      const description = result.embeds[0].data.description;

      // Should show coordinates as X;Y;Z format and link with X,Y
      expect(description).toContain("13044.9;7786.9;250.5");
      expect(description).toContain("https://www.izurvive.com/livonia/#location=13044.9;7786.9");
    });

    test("handles partially populated victim stats without showing undefined or NaN", () => {
      const killEvent = createExplosionEvent({
        victim: "TestVictim",
        device: "Grenade",
        t: "14:23:45",
      });

      const victimStats = {
        score: 50.5,
        kills: 2,
        // Missing: rank, deaths, kd, lastTimeAlive
      } satisfies Partial<PlayerStats>;

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
      const killEvent = createExplosionEvent({
        victim: "TestVictim",
        device: "Landmine",
        t: "14:23:45",
      });

      const victimStats = {
        rank: "Private",
        score: 100,
        kills: 8,
        deaths: 5,
        kd: 1.6,
        // Missing: lastTimeAlive
      } satisfies Partial<PlayerStats>;

      const result = embedExplosion(killEvent, null, victimStats);

      const description = result.embeds[0].data.description;

      // Should show "0m" for missing lastTimeAlive
      expect(description).toContain("**Time Alive:** 0m");
      expect(description).not.toContain("undefined");
    });
  });
});
