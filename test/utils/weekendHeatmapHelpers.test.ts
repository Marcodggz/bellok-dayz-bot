import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MAP_SIZE } from "../../src/config/config.ts";

let state;
let saveWeekendHeat;
let addWeekendHeatPoint;
let isWeekendHeatmapActive;

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-18T12:00:00Z"));

  vi.resetModules();

  state = {
    points: [],
    messageId: null,
    lastUpdate: 0,
  };

  saveWeekendHeat = vi.fn((nextState) => {
    state = structuredClone(nextState);
  });

  vi.doMock("../../src/storage/weekendHeatStore.js", () => ({
    loadWeekendHeat: () => structuredClone(state),
    saveWeekendHeat,
  }));

  ({ addWeekendHeatPoint, isWeekendHeatmapActive } =
    await import("../../src/utils/weekendHeatmapHelpers.ts"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.resetModules();
});

describe("isWeekendHeatmapActive", () => {
  test.each([
    ["Friday", "2026-07-17T12:00:00Z"],
    ["Saturday", "2026-07-18T12:00:00Z"],
    ["Sunday", "2026-07-19T12:00:00Z"],
  ])("returns true on %s", (_label, date) => {
    expect(isWeekendHeatmapActive(new Date(date))).toBe(true);
  });

  test.each([
    ["Monday", "2026-07-20T12:00:00Z"],
    ["Tuesday", "2026-07-21T12:00:00Z"],
    ["Wednesday", "2026-07-22T12:00:00Z"],
    ["Thursday", "2026-07-23T12:00:00Z"],
  ])("returns false on %s", (_label, date) => {
    expect(isWeekendHeatmapActive(new Date(date))).toBe(false);
  });
});

describe("addWeekendHeatPoint", () => {
  test("keeps only the latest position for the same player", () => {
    addWeekendHeatPoint("Vinnizd", 1000, 2000);

    vi.setSystemTime(new Date("2026-07-18T12:01:00Z"));
    addWeekendHeatPoint("Vinnizd", 3000, 4000);

    expect(state.points).toHaveLength(1);
    expect(state.points[0]).toMatchObject({
      name: "Vinnizd",
      x: 3000,
      y: 4000,
    });
  });

  test("removes every older stored position for the same player", () => {
    state.points = [
      { name: "Vinnizd", x: 1000, y: 2000, ts: Date.now() - 2000 },
      { name: "Vinnizd", x: 3000, y: 4000, ts: Date.now() - 1000 },
      { name: "OtherPlayer", x: 5000, y: 6000, ts: Date.now() },
    ];

    addWeekendHeatPoint("Vinnizd", 7000, 8000);

    expect(state.points).toHaveLength(2);
    expect(state.points.filter((point) => point.name === "Vinnizd")).toEqual([
      expect.objectContaining({
        x: 7000,
        y: 8000,
      }),
    ]);
  });

  test("keeps one latest position for each different player", () => {
    addWeekendHeatPoint("PlayerA", 1000, 2000);
    addWeekendHeatPoint("PlayerB", 3000, 4000);

    expect(state.points).toHaveLength(2);
    expect(state.points.map((point) => point.name)).toEqual(["PlayerA", "PlayerB"]);
  });

  test("does not store positions outside Friday through Sunday", () => {
    vi.setSystemTime(new Date("2026-07-20T12:00:00Z"));

    addWeekendHeatPoint("WeekdayPlayer", 1000, 2000);

    expect(state.points).toEqual([]);
    expect(saveWeekendHeat).not.toHaveBeenCalled();
  });

  test.each([
    ["non-finite X", Number.NaN, 2000],
    ["non-finite Y", 1000, Number.POSITIVE_INFINITY],
    ["negative X", -1, 2000],
    ["negative Y", 1000, -1],
    ["X beyond map size", MAP_SIZE + 1, 2000],
    ["Y beyond map size", 1000, MAP_SIZE + 1],
  ])("rejects %s coordinates", (_label, x, y) => {
    addWeekendHeatPoint("InvalidPlayer", x, y);

    expect(state.points).toEqual([]);
    expect(saveWeekendHeat).not.toHaveBeenCalled();
  });

  test("accepts coordinates on the map boundaries", () => {
    addWeekendHeatPoint("OriginPlayer", 0, 0);
    addWeekendHeatPoint("EdgePlayer", MAP_SIZE, MAP_SIZE);

    expect(state.points).toEqual([
      expect.objectContaining({
        name: "OriginPlayer",
        x: 0,
        y: 0,
      }),
      expect.objectContaining({
        name: "EdgePlayer",
        x: MAP_SIZE,
        y: MAP_SIZE,
      }),
    ]);
  });
});
