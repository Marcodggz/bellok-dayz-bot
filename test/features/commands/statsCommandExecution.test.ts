import { beforeEach, describe, expect, test, vi } from "vitest";
import { EmbedBuilder, MessageFlags, type ChatInputCommandInteraction } from "discord.js";
import type { PersistedPlayerStatsCollection } from "../../../src/types/domainPersistence.ts";

const mocks = vi.hoisted(() => ({
  getGamertagByDiscordUserId: vi.fn(),
  getDiscordUserIdByGamertag: vi.fn(),
  loadPlayerStats: vi.fn(),
  findPlayerStats: vi.fn(),
  getEstimatedAdmTimeMs: vi.fn(),
  getRankBadgePath: vi.fn(),
}));

vi.mock("../../../src/storage/linkedGamertagsStore.js", () => ({
  getGamertagByDiscordUserId: mocks.getGamertagByDiscordUserId,
  getDiscordUserIdByGamertag: mocks.getDiscordUserIdByGamertag,
}));

vi.mock("../../../src/storage/playerStatsStore.js", () => ({
  loadPlayerStats: mocks.loadPlayerStats,
  findPlayerStats: mocks.findPlayerStats,
}));

vi.mock("../../../src/features/stats/admClock.js", () => ({
  getEstimatedAdmTimeMs: mocks.getEstimatedAdmTimeMs,
}));

vi.mock("../../../src/utils/rankBadges.js", () => ({
  getRankBadgePath: mocks.getRankBadgePath,
}));

vi.mock("../../../src/config/config.js", () => ({
  SERVER_NAME: "Bellok DayZ Server",
}));

import { statsCommand } from "../../../src/features/commands/statsCommand.ts";

interface MockInteraction {
  interaction: ChatInputCommandInteraction;
  reply: ReturnType<typeof vi.fn>;
}

function createInteraction(playerOption: string | null, userId = "discord-user"): MockInteraction {
  const reply = vi.fn(async () => undefined);

  const interaction = {
    options: {
      getString: vi.fn(() => playerOption),
    },
    user: {
      id: userId,
    },
    reply,
  } as unknown as ChatInputCommandInteraction;

  return {
    interaction,
    reply,
  };
}

function createRecordedStats(
  overrides: PersistedPlayerStatsCollection[string] = {}
): PersistedPlayerStatsCollection[string] {
  return {
    kills: 3,
    deaths: 2,
    kd: 1.5,
    headshots: 1,
    killStreak: 1,
    score: 25,
    rank: "Private",
    accumulatedPlayedMs: 900_000,
    accumulatedAliveMs: 300_000,
    isConnected: false,
    isAlive: true,
    ...overrides,
  };
}

describe("statsCommand execute", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.getGamertagByDiscordUserId.mockReturnValue(null);
    mocks.getDiscordUserIdByGamertag.mockReturnValue(null);
    mocks.loadPlayerStats.mockReturnValue({});
    mocks.findPlayerStats.mockReturnValue(null);
    mocks.getEstimatedAdmTimeMs.mockReturnValue(null);
    mocks.getRankBadgePath.mockReturnValue(null);
  });

  test("uses the linked gamertag when no player option is provided", async () => {
    const stats = createRecordedStats();
    const allStats = {
      LinkedPlayer: stats,
    };

    mocks.getGamertagByDiscordUserId.mockReturnValue("LinkedPlayer");
    mocks.loadPlayerStats.mockReturnValue(allStats);
    mocks.findPlayerStats.mockReturnValue({
      gamertag: "LinkedPlayer",
      stats,
    });
    mocks.getDiscordUserIdByGamertag.mockReturnValue("discord-user");

    const { interaction, reply } = createInteraction(null);

    await statsCommand.execute(interaction);

    expect(mocks.findPlayerStats).toHaveBeenCalledWith(allStats, "LinkedPlayer");
    expect(reply).toHaveBeenCalledTimes(1);

    const payload = reply.mock.calls[0]?.[0];
    const embed = payload?.embeds?.[0];

    expect(embed).toBeInstanceOf(EmbedBuilder);

    if (!(embed instanceof EmbedBuilder)) {
      throw new Error("Stats reply did not contain an EmbedBuilder");
    }

    const values = (embed.toJSON().fields ?? []).map((field) => field.value).join("\n");

    expect(values).toContain("**Discord:** <@discord-user>");
  });

  test("allows manual lookup of an unlinked player", async () => {
    const stats = createRecordedStats();
    const allStats = {
      UnlinkedPlayer: stats,
    };

    mocks.loadPlayerStats.mockReturnValue(allStats);
    mocks.findPlayerStats.mockReturnValue({
      gamertag: "UnlinkedPlayer",
      stats,
    });

    const { interaction, reply } = createInteraction("  unlinkedplayer  ");

    await statsCommand.execute(interaction);

    expect(mocks.getGamertagByDiscordUserId).not.toHaveBeenCalled();
    expect(mocks.findPlayerStats).toHaveBeenCalledWith(allStats, "unlinkedplayer");

    const payload = reply.mock.calls[0]?.[0];
    const embed = payload?.embeds?.[0];

    expect(embed).toBeInstanceOf(EmbedBuilder);

    if (!(embed instanceof EmbedBuilder)) {
      throw new Error("Manual stats reply did not contain an EmbedBuilder");
    }

    const values = (embed.toJSON().fields ?? []).map((field) => field.value).join("\n");

    expect(values).toContain("**Discord:** Not Linked");
  });

  test("rejects a player with less than ten minutes of playtime", async () => {
    const stats = createRecordedStats({
      accumulatedPlayedMs: 599_999,
    });

    mocks.loadPlayerStats.mockReturnValue({
      NewPlayer: stats,
    });
    mocks.findPlayerStats.mockReturnValue({
      gamertag: "NewPlayer",
      stats,
    });

    const { interaction, reply } = createInteraction("NewPlayer");

    await statsCommand.execute(interaction);

    expect(reply).toHaveBeenCalledWith({
      content:
        "❌ No statistics have been recorded for **NewPlayer** yet. Play on the server for at least 10 minutes, then try again.",
    });
  });

  test("allows exactly ten minutes of playtime", async () => {
    const stats = createRecordedStats({
      accumulatedPlayedMs: 600_000,
    });

    mocks.loadPlayerStats.mockReturnValue({
      EligiblePlayer: stats,
    });
    mocks.findPlayerStats.mockReturnValue({
      gamertag: "EligiblePlayer",
      stats,
    });

    const { interaction, reply } = createInteraction("EligiblePlayer");

    await statsCommand.execute(interaction);

    const payload = reply.mock.calls[0]?.[0];

    expect(payload?.embeds).toHaveLength(1);
  });

  test("returns the unknown-player message for a missing manual gamertag", async () => {
    const { interaction, reply } = createInteraction("MissingPlayer");

    await statsCommand.execute(interaction);

    expect(reply).toHaveBeenCalledWith({
      content:
        "❌ Specified gamertag does not exist on **Bellok DayZ Server**!\nPlease check the spelling and try again.",
      flags: MessageFlags.Ephemeral,
    });
  });

  test("asks an unlinked Discord user to link or provide a player", async () => {
    const { interaction, reply } = createInteraction(null);

    await statsCommand.execute(interaction);

    expect(mocks.loadPlayerStats).not.toHaveBeenCalled();
    expect(reply).toHaveBeenCalledWith({
      content:
        "❌ You don't have a linked gamertag. Please use `/link gamertag` first, or provide a player name with `/stats player: Gamertag`",
      flags: MessageFlags.Ephemeral,
    });
  });

  test("returns an ephemeral error when loading statistics fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    mocks.loadPlayerStats.mockImplementation(() => {
      throw new Error("disk failure");
    });

    const { interaction, reply } = createInteraction("Player");

    await statsCommand.execute(interaction);

    expect(reply).toHaveBeenCalledWith({
      content: "❌ An error occurred while retrieving stats.",
      flags: MessageFlags.Ephemeral,
    });

    consoleError.mockRestore();
  });
});
