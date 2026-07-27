import { describe, expect, test } from "vitest";
import { processNonPvpDeathLine } from "../../../src/features/stats/nonPvpDeathProcessor.ts";
import { createEmptyStats, handlePlayerConnect } from "../../../src/features/stats/playerStats.ts";

describe("nonPvpDeathProcessor", () => {
  test("closes the life for a confirmed bear death", () => {
    const stats = createEmptyStats();
    const line =
      '19:09:56 | Player "BL6CKx" (DEAD) (id=test pos=<1545.5, 7429.6, 182.6>) killed by Animal_UrsusArctos';

    handlePlayerConnect(stats, "BL6CKx", 68_000_000);

    const event = processNonPvpDeathLine(line, stats, 68_996_000);

    expect(event?.cause).toBe("bear");
    expect(stats.BL6CKx).toMatchObject({
      deaths: 0,
      deathStreak: 0,
      killStreak: 0,
      lastTimeAlive: "00H 16M 36S",
      accumulatedPlayedMs: 996_000,
      accumulatedAliveMs: 0,
      connectedSince: null,
      isConnected: false,
      isAlive: false,
    });
  });

  test("does not process a bear hit or unconsciousness", () => {
    const stats = createEmptyStats();

    handlePlayerConnect(stats, "BL6CKx", 68_000_000);

    expect(
      processNonPvpDeathLine(
        '19:08:09 | Player "BL6CKx" (id=test pos=<1548.2, 7434.2, 182.1>)[HP: 51.5565] hit by Brown Bear into Torso(36) for 23.75 damage (MeleeBearShock)',
        stats,
        68_889_000
      )
    ).toBeNull();

    expect(
      processNonPvpDeathLine(
        '19:08:10 | Player "BL6CKx" (id=test pos=<1548.4, 7436.0, 182.0>) is unconscious',
        stats,
        68_890_000
      )
    ).toBeNull();

    expect(stats.BL6CKx.isAlive).toBe(true);
    expect(stats.BL6CKx.isConnected).toBe(true);
    expect(stats.BL6CKx.connectedSince).toBe(68_000_000);
  });

  test("processes only died. Stats from a suicide sequence", () => {
    const stats = createEmptyStats();

    handlePlayerConnect(stats, "BL6CKx", 70_065_000);

    expect(
      processNonPvpDeathLine(
        '19:27:51 | Player "BL6CKx" (id=test pos=<1205.0, 6919.1, 239.8>) performed EmoteSuicide with FAL',
        stats,
        70_071_000
      )
    ).toBeNull();

    expect(
      processNonPvpDeathLine(
        '19:27:56 | Player "BL6CKx" (id=test pos=<1205.0, 6919.1, 239.8>) committed suicide',
        stats,
        70_076_000
      )
    ).toBeNull();

    const deathLine =
      '19:27:56 | Player "BL6CKx" (DEAD) (id=test pos=<1205.0, 6919.1, 239.8>) died. Stats> Water: 599.921 Energy: 599.921 Bleed sources: 0';

    expect(processNonPvpDeathLine(deathLine, stats, 70_076_000)?.cause).toBe("general");
    expect(stats.BL6CKx.lastTimeAlive).toBe("00H 00M 11S");
    expect(stats.BL6CKx.isAlive).toBe(false);
  });

  test("ignores bled out after the canonical general death", () => {
    const stats = createEmptyStats();
    const deathLine =
      '13:20:52 | Player "LeFleur0" (DEAD) (id=test pos=<1169.6, 7470.9, 180.7>) died. Stats> Water: 557.416 Energy: 557.416 Bleed sources: 2';
    const bledOutLine =
      '13:20:52 | Player "LeFleur0" (DEAD) (id=test pos=<1169.6, 7470.9, 180.7>) bled out';

    handlePlayerConnect(stats, "LeFleur0", 48_000_000);

    processNonPvpDeathLine(deathLine, stats, 48_052_000);
    const lastTimeAlive = stats.LeFleur0.lastTimeAlive;

    expect(processNonPvpDeathLine(bledOutLine, stats, 48_052_000)).toBeNull();
    expect(stats.LeFleur0.lastTimeAlive).toBe(lastTimeAlive);
  });
});

describe("competitive death filtering", () => {
  test("does not classify died. Stats as non-PvP when a PvP death matches victim and time", () => {
    const stats = createEmptyStats();
    const deathLine =
      '12:05:00 | Player "Victim" (DEAD) (id=test pos=<1000.0, 2000.0, 50.0>) died. Stats> Water: 500 Energy: 500 Bleed sources: 0';

    handlePlayerConnect(stats, "Victim", 43_200_000);

    const event = processNonPvpDeathLine(deathLine, stats, 43_500_000, [
      {
        type: "pvp",
        killer: "Killer",
        victim: "Victim",
        weapon: "M4A1",
        t: "12:05:00",
        line: deathLine,
      },
    ]);

    expect(event).toBeNull();
    expect(stats.Victim.isAlive).toBe(true);
    expect(stats.Victim.isConnected).toBe(true);
    expect(stats.Victim.deaths).toBe(0);
    expect(stats.Victim.lastTimeAlive).toBeNull();
  });

  test("does not classify died. Stats as non-PvP when an explosion matches victim and time", () => {
    const stats = createEmptyStats();
    const deathLine =
      '14:50:54 | Player "Vinnizd" (DEAD) (id=test pos=<11341, 10046.8, 172.2>) died. Stats> Water: 500 Energy: 500 Bleed sources: 0';

    handlePlayerConnect(stats, "Vinnizd", 53_139_000);

    const event = processNonPvpDeathLine(deathLine, stats, 53_454_000, [
      {
        type: "explosion",
        victim: "Vinnizd",
        device: "6-M7 Frag Grenade",
        t: "14:50:54",
        line: deathLine,
      },
    ]);

    expect(event).toBeNull();
    expect(stats.Vinnizd.isAlive).toBe(true);
    expect(stats.Vinnizd.isConnected).toBe(true);
    expect(stats.Vinnizd.deaths).toBe(0);
  });

  test("still processes a general death when the competitive event has another time", () => {
    const stats = createEmptyStats();
    const deathLine =
      '12:05:00 | Player "Victim" (DEAD) (id=test pos=<1000.0, 2000.0, 50.0>) died. Stats> Water: 0 Energy: 0 Bleed sources: 0';

    handlePlayerConnect(stats, "Victim", 43_200_000);

    const event = processNonPvpDeathLine(deathLine, stats, 43_500_000, [
      {
        type: "pvp",
        killer: "Killer",
        victim: "Victim",
        weapon: "M4A1",
        t: "12:04:59",
        line: deathLine,
      },
    ]);

    expect(event?.cause).toBe("general");
    expect(stats.Victim.isAlive).toBe(false);
    expect(stats.Victim.lastTimeAlive).toBe("00H 05M 00S");
  });

  test("still processes explicit animal deaths", () => {
    const stats = createEmptyStats();
    const bearLine =
      '19:09:56 | Player "BL6CKx" (DEAD) (id=test pos=<1545.5, 7429.6, 182.6>) killed by Animal_UrsusArctos';

    handlePlayerConnect(stats, "BL6CKx", 68_000_000);

    const event = processNonPvpDeathLine(bearLine, stats, 68_996_000, [
      {
        type: "explosion",
        victim: "BL6CKx",
        device: "Landmine",
        t: "19:09:56",
        line: bearLine,
      },
    ]);

    expect(event?.cause).toBe("bear");
    expect(stats.BL6CKx.isAlive).toBe(false);
  });
});
