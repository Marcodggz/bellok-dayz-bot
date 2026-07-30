import { beforeEach, describe, expect, test, vi } from "vitest";
import type { ChatInputCommandInteraction } from "discord.js";
import type { PersistedPlayerStatsCollection } from "../../../src/types/domainPersistence.ts";

const mocks = vi.hoisted(() => ({
  loadPlayerStatsForLeaderboard: vi.fn(),
  replyLeaderboard: vi.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue(undefined),
  getEstimatedAdmTimeMs: vi.fn(),
}));

vi.mock("../../../src/features/commands/leaderboardHelpers.js", () => ({
  getTopPlayers: <T>(
    players: T[],
    sortFn: (firstPlayer: T, secondPlayer: T) => number,
    limit = 15
  ): T[] => players.sort(sortFn).slice(0, limit),
  loadPlayerStatsForLeaderboard: mocks.loadPlayerStatsForLeaderboard,
  replyLeaderboard: mocks.replyLeaderboard,
}));

vi.mock("../../../src/features/stats/admClock.js", () => ({
  getEstimatedAdmTimeMs: mocks.getEstimatedAdmTimeMs,
}));

import { leaderboardCommand } from "../../../src/features/commands/leaderboardCommand.ts";

function createInteraction(subcommand: string): ChatInputCommandInteraction {
  return {
    options: {
      getSubcommand: vi.fn(() => subcommand),
    },
    reply: vi.fn(async () => undefined),
  } as unknown as ChatInputCommandInteraction;
}

function getLeaderboardPlayers<T>(): T[] {
  const call = mocks.replyLeaderboard.mock.calls.at(-1);

  if (!call) {
    throw new Error("Leaderboard reply was not called");
  }

  const players = call[2];

  if (!Array.isArray(players)) {
    throw new Error("Leaderboard players were not provided");
  }

  return players as T[];
}

describe("leaderboardCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getEstimatedAdmTimeMs.mockReturnValue(null);
  });

  test("orders kill streaks by the current streak instead of the historical best", async () => {
    const stats: PersistedPlayerStatsCollection = {
      CurrentLeader: {
        kills: 5,
        deaths: 1,
        killStreak: 4,
        bestKillStreak: 4,
      },
      FormerLeader: {
        kills: 10,
        deaths: 2,
        killStreak: 1,
        bestKillStreak: 8,
      },
    };

    mocks.loadPlayerStatsForLeaderboard.mockReturnValue(stats);

    await leaderboardCommand.execute(createInteraction("killstreak"));

    expect(getLeaderboardPlayers<{ gamertag: string; killStreak: number }>()).toEqual([
      { gamertag: "CurrentLeader", killStreak: 4 },
      { gamertag: "FormerLeader", killStreak: 1 },
    ]);
  });

  test("orders death streaks by the current streak instead of the historical worst", async () => {
    const stats: PersistedPlayerStatsCollection = {
      CurrentLeader: {
        kills: 1,
        deaths: 5,
        deathStreak: 4,
        worstDeathStreak: 4,
      },
      FormerLeader: {
        kills: 2,
        deaths: 10,
        deathStreak: 1,
        worstDeathStreak: 8,
      },
    };

    mocks.loadPlayerStatsForLeaderboard.mockReturnValue(stats);

    await leaderboardCommand.execute(createInteraction("deathstreak"));

    expect(getLeaderboardPlayers<{ gamertag: string; deathStreak: number }>()).toEqual([
      { gamertag: "CurrentLeader", deathStreak: 4 },
      { gamertag: "FormerLeader", deathStreak: 1 },
    ]);
  });

  test("includes active session time for connected living players", async () => {
    const stats: PersistedPlayerStatsCollection = {
      ConnectedAlive: {
        isAlive: true,
        isConnected: true,
        connectedSince: 100_000,
        accumulatedAliveMs: 60_000,
      },
      DisconnectedAlive: {
        isAlive: true,
        isConnected: false,
        connectedSince: null,
        accumulatedAliveMs: 240_000,
      },
      DeadPlayer: {
        isAlive: false,
        isConnected: false,
        connectedSince: null,
        accumulatedAliveMs: 500_000,
      },
    };

    mocks.loadPlayerStatsForLeaderboard.mockReturnValue(stats);
    mocks.getEstimatedAdmTimeMs.mockReturnValue(400_000);

    await leaderboardCommand.execute(createInteraction("timealive"));

    expect(getLeaderboardPlayers<{ gamertag: string; currentTimeAliveMs: number }>()).toEqual([
      { gamertag: "ConnectedAlive", currentTimeAliveMs: 360_000 },
      { gamertag: "DisconnectedAlive", currentTimeAliveMs: 240_000 },
    ]);
  });

  test("includes active session time in total playtime", async () => {
    const stats: PersistedPlayerStatsCollection = {
      ConnectedPlayer: {
        isConnected: true,
        connectedSince: 100_000,
        accumulatedPlayedMs: 120_000,
      },
      DisconnectedPlayer: {
        isConnected: false,
        connectedSince: null,
        accumulatedPlayedMs: 300_000,
      },
    };

    mocks.loadPlayerStatsForLeaderboard.mockReturnValue(stats);
    mocks.getEstimatedAdmTimeMs.mockReturnValue(400_000);

    await leaderboardCommand.execute(createInteraction("timeplayed"));

    expect(getLeaderboardPlayers<{ gamertag: string; currentTimePlayedMs: number }>()).toEqual([
      { gamertag: "ConnectedPlayer", currentTimePlayedMs: 420_000 },
      { gamertag: "DisconnectedPlayer", currentTimePlayedMs: 300_000 },
    ]);
  });
  test("orders rank entries by score and preserves the stored rank", async () => {
    const stats: PersistedPlayerStatsCollection = {
      HighestScore: {
        kills: 8,
        deaths: 2,
        score: 125.8,
        rank: "Private First Class",
      },
      LowerScore: {
        kills: 4,
        deaths: 3,
        score: 56.4,
        rank: "Private",
      },
      NoPvpActivity: {
        score: 500,
        rank: "Corporal",
      },
    };

    mocks.loadPlayerStatsForLeaderboard.mockReturnValue(stats);

    await leaderboardCommand.execute(createInteraction("rank"));

    expect(
      getLeaderboardPlayers<{
        gamertag: string;
        score: number;
        rank: string;
      }>()
    ).toEqual([
      {
        gamertag: "HighestScore",
        score: 125.8,
        rank: "Private First Class",
      },
      {
        gamertag: "LowerScore",
        score: 56.4,
        rank: "Private",
      },
    ]);
  });

  test("orders kills descending and includes active PVP players with zero kills", async () => {
    const stats: PersistedPlayerStatsCollection = {
      Killer: {
        kills: 9,
        deaths: 2,
      },
      VictimOnly: {
        kills: 0,
        deaths: 4,
      },
      NoPvpActivity: {
        kills: 0,
        deaths: 0,
      },
    };

    mocks.loadPlayerStatsForLeaderboard.mockReturnValue(stats);

    await leaderboardCommand.execute(createInteraction("kills"));

    expect(getLeaderboardPlayers<{ gamertag: string; kills: number }>()).toEqual([
      { gamertag: "Killer", kills: 9 },
      { gamertag: "VictimOnly", kills: 0 },
    ]);
  });

  test("orders deaths descending and includes active PVP players with zero deaths", async () => {
    const stats: PersistedPlayerStatsCollection = {
      MostDeaths: {
        kills: 1,
        deaths: 7,
      },
      KillerOnly: {
        kills: 5,
        deaths: 0,
      },
      NoPvpActivity: {
        kills: 0,
        deaths: 0,
      },
    };

    mocks.loadPlayerStatsForLeaderboard.mockReturnValue(stats);

    await leaderboardCommand.execute(createInteraction("deaths"));

    expect(getLeaderboardPlayers<{ gamertag: string; deaths: number }>()).toEqual([
      { gamertag: "MostDeaths", deaths: 7 },
      { gamertag: "KillerOnly", deaths: 0 },
    ]);
  });

  test("orders KD descending and uses zero for missing legacy values", async () => {
    const stats: PersistedPlayerStatsCollection = {
      BestKd: {
        kills: 8,
        deaths: 2,
        kd: 4,
      },
      LegacyPlayer: {
        kills: 1,
        deaths: 3,
      },
      NoPvpActivity: {
        kd: 10,
      },
    };

    mocks.loadPlayerStatsForLeaderboard.mockReturnValue(stats);

    await leaderboardCommand.execute(createInteraction("kd"));

    expect(getLeaderboardPlayers<{ gamertag: string; kd: number }>()).toEqual([
      { gamertag: "BestKd", kd: 4 },
      { gamertag: "LegacyPlayer", kd: 0 },
    ]);
  });

  test("orders headshots descending and uses zero for missing legacy values", async () => {
    const stats: PersistedPlayerStatsCollection = {
      Sharpshooter: {
        kills: 5,
        deaths: 1,
        headshots: 4,
      },
      LegacyPlayer: {
        kills: 2,
        deaths: 2,
      },
      NoPvpActivity: {
        headshots: 20,
      },
    };

    mocks.loadPlayerStatsForLeaderboard.mockReturnValue(stats);

    await leaderboardCommand.execute(createInteraction("headshots"));

    expect(getLeaderboardPlayers<{ gamertag: string; headshots: number }>()).toEqual([
      { gamertag: "Sharpshooter", headshots: 4 },
      { gamertag: "LegacyPlayer", headshots: 0 },
    ]);
  });

  test("orders longest kills descending and preserves the weapon", async () => {
    const stats: PersistedPlayerStatsCollection = {
      LongRange: {
        kills: 3,
        deaths: 1,
        longestKill: 392.161,
        longestKillWeapon: "LAR",
      },
      CloseRange: {
        kills: 1,
        deaths: 2,
        longestKill: 86.3843,
        longestKillWeapon: "M4A1",
      },
      NoPvpActivity: {
        longestKill: 500,
        longestKillWeapon: "Tundra",
      },
    };

    mocks.loadPlayerStatsForLeaderboard.mockReturnValue(stats);

    await leaderboardCommand.execute(createInteraction("longestkill"));

    expect(
      getLeaderboardPlayers<{
        gamertag: string;
        longestKill: number;
        longestKillWeapon: string | null;
      }>()
    ).toEqual([
      {
        gamertag: "LongRange",
        longestKill: 392.161,
        longestKillWeapon: "LAR",
      },
      {
        gamertag: "CloseRange",
        longestKill: 86.3843,
        longestKillWeapon: "M4A1",
      },
    ]);
  });
});
