// src/features/commands/leaderboardHelpers.js — Helper functions for leaderboard commands

const { EmbedBuilder } = require("discord.js");
const { SERVER_NAME } = require("../../config/config");
const { loadPlayerStats } = require("../../storage/playerStatsStore");

/**
 * Load player stats for leaderboard display
 * @returns {Object} - Player stats object
 */
function loadPlayerStatsForLeaderboard() {
  return loadPlayerStats();
}

/**
 * Build an empty leaderboard embed when no stats are available
 * @param {string} title - Leaderboard title
 * @returns {EmbedBuilder} - Empty leaderboard embed
 */
function buildEmptyLeaderboardEmbed(title) {
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

/**
 * Build a leaderboard embed with player data
 * @param {string} title - Leaderboard title
 * @param {Array} players - Array of player objects
 * @param {Function} formatValue - Function to format player value display
 * @returns {EmbedBuilder} - Populated leaderboard embed
 */
function buildLeaderboardEmbed(title, players, formatValue) {
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

/**
 * Get top players from an array based on sort function
 * @param {Array} players - Array of player objects
 * @param {Function} sortFn - Sort comparison function
 * @param {number} limit - Maximum number of players to return (default: 15)
 * @returns {Array} - Sorted and limited array of top players
 */
function getTopPlayers(players, sortFn, limit = 15) {
  return players.sort(sortFn).slice(0, limit);
}

/**
 * Reply to interaction with a leaderboard embed
 * @param {import('discord.js').CommandInteraction} interaction - Discord interaction
 * @param {string} title - Leaderboard title
 * @param {Array} playerArray - Array of player objects
 * @param {Function} formatValue - Function to format player value display
 */
async function replyLeaderboard(interaction, title, playerArray, formatValue) {
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

module.exports = {
  loadPlayerStatsForLeaderboard,
  buildEmptyLeaderboardEmbed,
  buildLeaderboardEmbed,
  getTopPlayers,
  replyLeaderboard,
};
