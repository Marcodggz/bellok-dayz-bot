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
});
