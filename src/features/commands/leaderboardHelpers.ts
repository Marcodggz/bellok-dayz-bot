// Helper functions for leaderboard commands

import { EmbedBuilder, type ChatInputCommandInteraction } from "discord.js";
import { SERVER_NAME } from "../../config/config";
import { loadPlayerStats } from "../../storage/playerStatsStore";
import type { PersistedPlayerStatsCollection } from "../../types/domainPersistence";

interface LeaderboardPlayer {
  gamertag: string;
}

export function loadPlayerStatsForLeaderboard(): PersistedPlayerStatsCollection {
  return loadPlayerStats();
}

export function buildEmptyLeaderboardEmbed(title: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x00ae86)
    .setTitle(title)
    .setDescription(
      `**${SERVER_NAME}**\n\nNo player stats available yet. Start playing to appear on the leaderboard!`
    )
    .setTimestamp()
    .setFooter({
      text: `Bellok's Killfeed`,
    });
}

export function buildLeaderboardEmbed<T extends LeaderboardPlayer>(
  title: string,
  players: T[],
  formatValue: (player: T) => string
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0x00ae86)
    .setTitle(title)
    .setDescription(`**${SERVER_NAME}**`)
    .setTimestamp();

  players.forEach((player, index) => {
    const position = index + 1;

    embed.addFields({
      name: `${position}. \`${player.gamertag}\``,
      value: formatValue(player),
      inline: true,
    });
  });

  embed.setFooter({
    text: `Bellok's Killfeed`,
  });

  return embed;
}

export function getTopPlayers<T>(
  players: T[],
  sortFn: (firstPlayer: T, secondPlayer: T) => number,
  limit = 15
): T[] {
  return players.sort(sortFn).slice(0, limit);
}

export async function replyLeaderboard<T extends LeaderboardPlayer>(
  interaction: ChatInputCommandInteraction,
  title: string,
  playerArray: T[],
  formatValue: (player: T) => string
): Promise<void> {
  if (playerArray.length === 0) {
    const emptyEmbed = buildEmptyLeaderboardEmbed(title);

    await interaction.reply({
      embeds: [emptyEmbed],
    });

    return;
  }

  const embed = buildLeaderboardEmbed(title, playerArray, formatValue);

  await interaction.reply({
    embeds: [embed],
  });
}
