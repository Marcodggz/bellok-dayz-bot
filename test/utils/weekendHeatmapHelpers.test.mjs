import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

let state;
let saveWeekendHeat;
let addWeekendHeatPoint;

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

  ({ addWeekendHeatPoint } = await import("../../src/utils/weekendHeatmapHelpers.ts"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.resetModules();
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
});
