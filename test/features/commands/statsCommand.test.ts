import { describe, expect, test } from "vitest";

import {
  buildMissingStatsMessage,
  buildStatsEmbed,
  buildUnknownPlayerMessage,
  formatStatsDuration,
} from "../../../src/features/commands/statsCommand.ts";

describe("statsCommand", () => {
  test("explains how to generate statistics for a new player", () => {
    expect(buildMissingStatsMessage("LeFleur0")).toBe(
      "❌ No statistics have been recorded for **LeFleur0** yet. Play on the server for at least 10 minutes, then try again."
    );
  });

  test("warns when a manually specified gamertag does not exist", () => {
    expect(buildUnknownPlayerMessage("Vanilla+ Livonia")).toBe(
      "❌ Specified gamertag does not exist on **Vanilla+ Livonia**!\nPlease note gamertags are case-sensitive, so they must be typed correctly."
    );
  });

  test("formats persisted durations", () => {
    expect(formatStatsDuration(0)).toBe("00H 00M 00S");
    expect(formatStatsDuration(3_661_000)).toBe("01H 01M 01S");
    expect(formatStatsDuration(90_061_000)).toBe("01D 01H 01M");
    expect(formatStatsDuration(undefined)).toBe("N/A");
  });

  test("shows detailed persisted player statistics", () => {
    const { embed } = buildStatsEmbed(
      "Survivor",
      {
        kills: 8,
        deaths: 4,
        headshots: 2,
        kd: 2,
        killStreak: 1,
        bestKillStreak: 5,
        deathStreak: 2,
        worstDeathStreak: 3,
        score: 100,
        rank: "Private First Class",
        longestKill: 125.5,
        longestKillWeapon: "Tundra",
        lastKill: "EnemyA",
        lastDeath: "EnemyB",
        weaponKills: {
          LAR: 2,
          M4A1: 4,
        },
        favouriteWeapon: "M4A1",
        connectedSince: null,
        accumulatedAliveMs: 600_000,
        isConnected: false,
        isAlive: true,
        lastTimeAlive: "00H 05M 00S",
        bestTimeAliveMs: 1_200_000,
        accumulatedPlayedMs: 7_200_000,
      },
      "Not Linked"
    );

    const fields = embed.toJSON().fields ?? [];
    const values = fields.map((field) => field.value).join("\n");

    expect(values).toContain("Best Kill Streak: **5**");
    expect(values).toContain("Worst Death Streak: **3**");
    expect(values).toContain("Last Kill: **EnemyA**");
    expect(values).toContain("Last Death: **EnemyB**");
    expect(values).toContain("Favourite Weapon: **M4A1**");
    expect(values).toContain("Time Played: **02H 00M 00S**");
    expect(values).toContain("Best Time Alive: **00H 20M 00S**");
    expect(values).toContain("Time Alive: **00H 10M 00S**");
  });

  test("uses safe fallbacks for legacy player data", () => {
    const { embed } = buildStatsEmbed(
      "Legacy",
      {
        kills: 2,
        deaths: 1,
      },
      "Not Linked"
    );

    const fields = embed.toJSON().fields ?? [];
    const values = fields.map((field) => field.value).join("\n");

    expect(values).toContain("Last Kill: **N/A**");
    expect(values).toContain("Last Death: **N/A**");
    expect(values).toContain("Favourite Weapon: **N/A**");
    expect(values).toContain("Time Played: **N/A**");
    expect(values).toContain("Best Time Alive: **N/A**");
  });
});

describe("current time alive", () => {
  test("includes the active connected session", async () => {
    const { calculateCurrentTimeAliveMs } =
      await import("../../../src/features/commands/statsCommand.ts");

    expect(
      calculateCurrentTimeAliveMs(
        {
          isAlive: true,
          isConnected: true,
          connectedSince: 10_000,
          accumulatedAliveMs: 20_000,
        },
        40_000
      )
    ).toBe(50_000);
  });

  test("shows only accumulated life while disconnected", async () => {
    const { calculateCurrentTimeAliveMs } =
      await import("../../../src/features/commands/statsCommand.ts");

    expect(
      calculateCurrentTimeAliveMs(
        {
          isAlive: true,
          isConnected: false,
          connectedSince: null,
          accumulatedAliveMs: 45_000,
        },
        100_000
      )
    ).toBe(45_000);
  });

  test("returns no current life after death", async () => {
    const { calculateCurrentTimeAliveMs } =
      await import("../../../src/features/commands/statsCommand.ts");

    expect(
      calculateCurrentTimeAliveMs(
        {
          isAlive: false,
          isConnected: false,
          connectedSince: null,
          accumulatedAliveMs: 0,
        },
        100_000
      )
    ).toBeNull();
  });
});
