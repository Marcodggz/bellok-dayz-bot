import { describe, expect, test } from "vitest";
import { findPlayerStats } from "../../src/storage/playerStatsStore.ts";

describe("findPlayerStats", () => {
  const allStats = {
    Bellok: { kills: 10 },
    Marco: { kills: 5 },
  };

  test("returns an exact gamertag match", () => {
    expect(findPlayerStats(allStats, "Bellok")).toEqual({
      gamertag: "Bellok",
      stats: { kills: 10 },
    });
  });

  test("returns a unique case-insensitive match", () => {
    expect(findPlayerStats(allStats, "  bellok  ")).toEqual({
      gamertag: "Bellok",
      stats: { kills: 10 },
    });
  });

  test("returns null when no player matches", () => {
    expect(findPlayerStats(allStats, "UnknownPlayer")).toBeNull();
  });

  test("returns null for ambiguous case-insensitive matches", () => {
    const ambiguousStats = {
      Bellok: { kills: 10 },
      BELLOK: { kills: 20 },
    };

    expect(findPlayerStats(ambiguousStats, "bellok")).toBeNull();
  });

  test("returns null for an empty gamertag", () => {
    expect(findPlayerStats(allStats, "   ")).toBeNull();
  });
});
