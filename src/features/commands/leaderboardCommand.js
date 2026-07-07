// src/features/commands/leaderboardCommand.js — Slash command for leaderboards

const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { loadMockStats } = require("../../storage/mockStatsStore");
const { SERVER_NAME } = require("../../config/config");

/**
 * Define the /leaderboard command with subcommands
 */
const leaderboardCommand = {
  data: new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("View server leaderboards")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("rank")
        .setDescription("View top 15 players ranked by score"),
    ),

  /**
   * Execute the /leaderboard command
   * @param {import('discord.js').CommandInteraction} interaction
   */
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    try {
      if (subcommand === "rank") {
        await handleRankLeaderboard(interaction);
      } else {
        await interaction.reply({
          content: "❌ Unknown subcommand.",
          ephemeral: true,
        });
      }
    } catch (error) {
      console.error("[leaderboard command error]", error);
      await interaction.reply({
        content: "❌ An error occurred while retrieving the leaderboard.",
        ephemeral: true,
      });
    }
  },
};

/**
 * Handle /leaderboard rank subcommand
 * @param {import('discord.js').CommandInteraction} interaction
 */
async function handleRankLeaderboard(interaction) {
  // Load all player stats
  const allStats = loadMockStats();

  // Convert stats object to array and filter out players with no activity
  const playerArray = Object.entries(allStats)
    .filter(([gamertag, stats]) => stats.kills > 0 || stats.deaths > 0)
    .map(([gamertag, stats]) => ({
      gamertag,
      score: stats.score ?? 0,
      rank: stats.rank || "Private",
    }));

  // Check if there are any stats
  if (playerArray.length === 0) {
    const emptyEmbed = new EmbedBuilder()
      .setColor(0x00ae86)
      .setTitle("Current Top 15 Ranks 🏅")
      .setDescription(
        `**${SERVER_NAME}**\n\nNo player stats available yet. Start playing to appear on the leaderboard!`,
      )
      .setTimestamp();

    await interaction.reply({
      embeds: [emptyEmbed],
      ephemeral: false,
    });
    return;
  }

  // Sort by score descending
  playerArray.sort((a, b) => b.score - a.score);

  // Take top 15
  const top15 = playerArray.slice(0, 15);

  // Build the embed with 3-column layout using inline fields
  const embed = new EmbedBuilder()
    .setColor(0x00ae86)
    .setTitle("Current Top 15 Ranks 🏅")
    .setDescription(`**${SERVER_NAME}**`)
    .setTimestamp();

  // Add players as inline fields (3 per row)
  top15.forEach((player, index) => {
    const position = index + 1;

    embed.addFields({
      name: `${position}. \`${player.gamertag}\``,
      value: `Rank: ${player.rank}\nScore: ${player.score.toFixed(1)}`,
      inline: true,
    });
  });

  // Add footer with bot name (timestamp is handled by .setTimestamp())
  embed.setFooter({
    text: `Bellok's Killfeed`,
  });

  await interaction.reply({
    embeds: [embed],
    ephemeral: false,
  });
}

module.exports = {
  leaderboardCommand,
};
