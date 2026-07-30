import { describe, expect, test, vi } from "vitest";
import { EmbedBuilder } from "discord.js";
import type { ChatInputCommandInteraction, InteractionReplyOptions } from "discord.js";

import {
  buildEmptyLeaderboardEmbed,
  buildLeaderboardEmbed,
  getTopPlayers,
  replyLeaderboard,
} from "../../../src/features/commands/leaderboardHelpers.ts";

describe("leaderboardHelpers", () => {
  test("sorts players and limits the result to 15 entries", () => {
    const players = Array.from({ length: 20 }, (_, index) => ({
      gamertag: `Player${index + 1}`,
      score: index + 1,
    }));

    const topPlayers = getTopPlayers(players, (a, b) => b.score - a.score);

    expect(topPlayers).toHaveLength(15);
    expect(topPlayers[0]).toEqual({
      gamertag: "Player20",
      score: 20,
    });
    expect(topPlayers[14]).toEqual({
      gamertag: "Player6",
      score: 6,
    });
  });

  test("builds a ranked leaderboard embed with formatted values", () => {
    const embed = buildLeaderboardEmbed(
      "Current Top Kills",
      [
        { gamertag: "Alpha", kills: 5 },
        { gamertag: "Bravo", kills: 3 },
      ],
      (player) => `Kills: ${player.kills}`
    );

    const data = embed.toJSON();

    expect(data.title).toBe("Current Top Kills");
    expect(data.fields).toEqual([
      {
        name: "1. `Alpha`",
        value: "Kills: 5",
        inline: true,
      },
      {
        name: "2. `Bravo`",
        value: "Kills: 3",
        inline: true,
      },
    ]);
    expect(data.footer?.text).toBe("Bellok's Killfeed");
  });

  test("builds an empty leaderboard embed", () => {
    const embed = buildEmptyLeaderboardEmbed("Current Top Kills");
    const data = embed.toJSON();

    expect(data.title).toBe("Current Top Kills");
    expect(data.description).toContain("No player stats available yet.");
    expect(data.footer?.text).toBe("Bellok's Killfeed");
  });

  test("replies with the populated leaderboard embed", async () => {
    const reply = vi
      .fn<(payload: InteractionReplyOptions) => Promise<void>>()
      .mockResolvedValue(undefined);
    const interaction = {
      reply,
    } as unknown as ChatInputCommandInteraction;

    await replyLeaderboard(
      interaction,
      "Current Top Kills",
      [{ gamertag: "Alpha", kills: 5 }],
      (player) => `Kills: ${player.kills}`
    );

    expect(reply).toHaveBeenCalledTimes(1);

    const payload = reply.mock.calls[0]?.[0];

    expect(payload).toBeDefined();
    expect(payload?.embeds).toHaveLength(1);

    const embed = payload?.embeds?.[0];

    expect(embed).toBeInstanceOf(EmbedBuilder);

    if (!(embed instanceof EmbedBuilder)) {
      throw new Error("Leaderboard reply did not contain an EmbedBuilder");
    }

    expect(embed.toJSON().fields?.[0]).toMatchObject({
      name: "1. `Alpha`",
      value: "Kills: 5",
    });
  });

  test("replies with the empty embed when no players qualify", async () => {
    const reply = vi
      .fn<(payload: InteractionReplyOptions) => Promise<void>>()
      .mockResolvedValue(undefined);
    const interaction = {
      reply,
    } as unknown as ChatInputCommandInteraction;

    await replyLeaderboard(interaction, "Current Top Kills", [], () => "Unused");

    expect(reply).toHaveBeenCalledTimes(1);

    const payload = reply.mock.calls[0]?.[0];

    expect(payload).toBeDefined();
    expect(payload?.embeds).toHaveLength(1);

    const embed = payload?.embeds?.[0];

    expect(embed).toBeInstanceOf(EmbedBuilder);

    if (!(embed instanceof EmbedBuilder)) {
      throw new Error("Empty leaderboard reply did not contain an EmbedBuilder");
    }

    expect(embed.toJSON().description).toContain("No player stats available yet.");
  });
});
