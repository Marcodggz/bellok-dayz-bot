import { createRequire } from "node:module";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const require = createRequire(import.meta.url);

const helpersPath = require.resolve("../../src/utils/weekendHeatmapHelpers.js");
const storePath = require.resolve("../../src/storage/weekendHeatStore.js");

let state;
let saveWeekendHeat;
let addWeekendHeatPoint;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-18T12:00:00Z"));

  delete require.cache[helpersPath];
  delete require.cache[storePath];

  state = {
    points: [],
    messageId: null,
    lastUpdate: 0,
  };

  saveWeekendHeat = vi.fn((nextState) => {
    state = structuredClone(nextState);
  });

  require.cache[storePath] = {
    id: storePath,
    filename: storePath,
    loaded: true,
    exports: {
      loadWeekendHeat: () => structuredClone(state),
      saveWeekendHeat,
    },
  };

  ({ addWeekendHeatPoint } = require(helpersPath));
});

afterEach(() => {
  vi.useRealTimers();
  delete require.cache[helpersPath];
  delete require.cache[storePath];
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
