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
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("kills")
        .setDescription("View top 15 players ranked by PVP kills"),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("deaths")
        .setDescription("View top 15 players ranked by PVP deaths"),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("kd")
        .setDescription("View top 15 players ranked by KD ratio"),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("headshots")
        .setDescription("View top 15 players ranked by headshots"),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("killstreak")
        .setDescription("View top 15 players ranked by best kill streak"),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("deathstreak")
        .setDescription("View top 15 players ranked by death streak"),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("longestkill")
        .setDescription("View top 15 players ranked by longest kill distance"),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("timealive")
        .setDescription("View top 15 players ranked by total time alive"),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("timeplayed")
        .setDescription("View top 15 players ranked by total time played"),
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
      } else if (subcommand === "kills") {
        await handleKillsLeaderboard(interaction);
      } else if (subcommand === "deaths") {
        await handleDeathsLeaderboard(interaction);
      } else if (subcommand === "kd") {
        await handleKdLeaderboard(interaction);
      } else if (subcommand === "headshots") {
        await handleHeadshotsLeaderboard(interaction);
      } else if (subcommand === "killstreak") {
        await handleKillStreakLeaderboard(interaction);
      } else if (subcommand === "deathstreak") {
        await handleDeathStreakLeaderboard(interaction);
      } else if (subcommand === "longestkill") {
        await handleLongestKillLeaderboard(interaction);
      } else if (subcommand === "timealive") {
        await handleTimeAliveLeaderboard(interaction);
      } else if (subcommand === "timeplayed") {
        await handleTimePlayedLeaderboard(interaction);
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

function loadPlayerStatsForLeaderboard() {
  return loadMockStats();
}

function buildEmptyLeaderboardEmbed(title) {
  return new EmbedBuilder()
    .setColor(0x00ae86)
    .setTitle(title)
    .setDescription(
      `**${SERVER_NAME}**\n\nNo player stats available yet. Start playing to appear on the leaderboard!`,
    )
    .setTimestamp()
    .setFooter({
      text: `Bellok's Killfeed`,
    });
}

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

function getTopPlayers(players, sortFn, limit = 15) {
  return players.sort(sortFn).slice(0, limit);
}

async function replyLeaderboard(interaction, title, playerArray, formatValue) {
  if (playerArray.length === 0) {
    const emptyEmbed = buildEmptyLeaderboardEmbed(title);
    await interaction.reply({
      embeds: [emptyEmbed],
      ephemeral: false,
    });
    return;
  }

  const embed = buildLeaderboardEmbed(title, playerArray, formatValue);
  await interaction.reply({
    embeds: [embed],
    ephemeral: false,
  });
}

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
      .setTimestamp()
      .setFooter({
        text: `Bellok's Killfeed`,
      });

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

/**
 * Handle /leaderboard kills subcommand
 * @param {import('discord.js').CommandInteraction} interaction
 */
async function handleKillsLeaderboard(interaction) {
  const allStats = loadPlayerStatsForLeaderboard();

  const playerArray = Object.entries(allStats)
    .filter(([gamertag, stats]) => stats.kills > 0 || stats.deaths > 0)
    .map(([gamertag, stats]) => ({
      gamertag,
      kills: stats.kills ?? 0,
    }));

  const top15 = getTopPlayers(playerArray, (a, b) => b.kills - a.kills);

  await replyLeaderboard(
    interaction,
    "Current Top 15 Kills 🔫",
    top15,
    (player) => `Kills: ${player.kills}`,
  );
}

/**
 * Handle /leaderboard deaths subcommand
 * @param {import('discord.js').CommandInteraction} interaction
 */
async function handleDeathsLeaderboard(interaction) {
  const allStats = loadPlayerStatsForLeaderboard();

  const playerArray = Object.entries(allStats)
    .filter(([gamertag, stats]) => stats.kills > 0 || stats.deaths > 0)
    .map(([gamertag, stats]) => ({
      gamertag,
      deaths: stats.deaths ?? 0,
    }));

  const top15 = getTopPlayers(playerArray, (a, b) => b.deaths - a.deaths);

  await replyLeaderboard(
    interaction,
    "Current Top 15 Deaths ☠️",
    top15,
    (player) => `Deaths: ${player.deaths}`,
  );
}

/**
 * Handle /leaderboard kd subcommand
 * @param {import('discord.js').CommandInteraction} interaction
 */
async function handleKdLeaderboard(interaction) {
  const allStats = loadPlayerStatsForLeaderboard();

  const playerArray = Object.entries(allStats)
    .filter(([gamertag, stats]) => stats.kills > 0 || stats.deaths > 0)
    .map(([gamertag, stats]) => ({
      gamertag,
      kd: stats.kd ?? 0,
    }));

  const top15 = getTopPlayers(playerArray, (a, b) => b.kd - a.kd);

  await replyLeaderboard(
    interaction,
    "Current Top 15 KD ⚔️",
    top15,
    (player) => `KD: ${player.kd.toFixed(2)}`,
  );
}

/**
 * Handle /leaderboard headshots subcommand
 * @param {import('discord.js').CommandInteraction} interaction
 */
async function handleHeadshotsLeaderboard(interaction) {
  const allStats = loadPlayerStatsForLeaderboard();

  const playerArray = Object.entries(allStats)
    .filter(([gamertag, stats]) => stats.kills > 0 || stats.deaths > 0)
    .map(([gamertag, stats]) => ({
      gamertag,
      headshots: stats.headshots ?? 0,
    }));

  const top15 = getTopPlayers(playerArray, (a, b) => b.headshots - a.headshots);

  await replyLeaderboard(
    interaction,
    "Current Top 15 Headshots 🎯",
    top15,
    (player) => `Headshots: ${player.headshots}`,
  );
}

/**
 * Handle /leaderboard killstreak subcommand
 * @param {import('discord.js').CommandInteraction} interaction
 */
async function handleKillStreakLeaderboard(interaction) {
  const allStats = loadPlayerStatsForLeaderboard();

  const playerArray = Object.entries(allStats)
    .filter(([gamertag, stats]) => stats.kills > 0 || stats.deaths > 0)
    .map(([gamertag, stats]) => ({
      gamertag,
      killStreak: stats.killStreak ?? 0,
    }));

  const top15 = getTopPlayers(
    playerArray,
    (a, b) => b.killStreak - a.killStreak,
  );

  await replyLeaderboard(
    interaction,
    "Current Top 15 Kill Streaks 🔥",
    top15,
    (player) => `Kill Streak: ${player.killStreak}`,
  );
}

/**
 * Handle /leaderboard deathstreak subcommand
 * @param {import('discord.js').CommandInteraction} interaction
 */
async function handleDeathStreakLeaderboard(interaction) {
  const allStats = loadPlayerStatsForLeaderboard();

  const playerArray = Object.entries(allStats)
    .filter(([gamertag, stats]) => stats.kills > 0 || stats.deaths > 0)
    .map(([gamertag, stats]) => ({
      gamertag,
      deathStreak: stats.deathStreak ?? 0,
    }));

  const top15 = getTopPlayers(
    playerArray,
    (a, b) => b.deathStreak - a.deathStreak,
  );

  await replyLeaderboard(
    interaction,
    "Current Top 15 Death Streaks 💀",
    top15,
    (player) => `Death Streak: ${player.deathStreak}`,
  );
}

/**
 * Handle /leaderboard longestkill subcommand
 * @param {import('discord.js').CommandInteraction} interaction
 */
async function handleLongestKillLeaderboard(interaction) {
  const allStats = loadPlayerStatsForLeaderboard();

  const playerArray = Object.entries(allStats)
    .filter(([gamertag, stats]) => stats.kills > 0 || stats.deaths > 0)
    .map(([gamertag, stats]) => ({
      gamertag,
      longestKill: stats.longestKill ?? 0,
      longestKillWeapon: stats.longestKillWeapon ?? null,
    }));

  const top15 = getTopPlayers(
    playerArray,
    (a, b) => b.longestKill - a.longestKill,
  );

  await replyLeaderboard(
    interaction,
    "Current Top 15 Longest Kills 🔭",
    top15,
    (player) => {
      const weapon = player.longestKillWeapon || "Unknown";
      const distance = player.longestKill ?? 0;
      return `${weapon} (${distance.toFixed(2)}m)`;
    },
  );
}

/**
 * Handle /leaderboard timealive subcommand
 * @param {import('discord.js').CommandInteraction} interaction
 */
async function handleTimeAliveLeaderboard(interaction) {
  // Load all player stats
  const allStats = loadMockStats();

  // Convert stats object to array and filter out players with no activity
  const playerArray = Object.entries(allStats)
    .filter(
      ([gamertag, stats]) =>
        stats.kills > 0 ||
        stats.deaths > 0 ||
        (stats.accumulatedAliveMs ?? 0) > 0,
    )
    .map(([gamertag, stats]) => ({
      gamertag,
      accumulatedAliveMs: stats.accumulatedAliveMs ?? 0,
    }));

  // Check if there are any stats
  if (playerArray.length === 0) {
    const emptyEmbed = new EmbedBuilder()
      .setColor(0x00ae86)
      .setTitle("Current Top 15 Lives ⏳")
      .setDescription(
        `**${SERVER_NAME}**\n\nNo player stats available yet. Start playing to appear on the leaderboard!`,
      )
      .setTimestamp()
      .setFooter({
        text: `Bellok's Killfeed`,
      });

    await interaction.reply({
      embeds: [emptyEmbed],
      ephemeral: false,
    });
    return;
  }

  // Sort by accumulated alive time descending
  playerArray.sort((a, b) => b.accumulatedAliveMs - a.accumulatedAliveMs);

  // Take top 15
  const top15 = playerArray.slice(0, 15);

  // Build the embed with 3-column layout using inline fields
  const embed = new EmbedBuilder()
    .setColor(0x00ae86)
    .setTitle("Current Top 15 Lives ⏳")
    .setDescription(`**${SERVER_NAME}**`)
    .setTimestamp();

  // Add players as inline fields (3 per row)
  top15.forEach((player, index) => {
    const position = index + 1;
    const formattedTime = formatTimeAliveForLeaderboard(
      player.accumulatedAliveMs,
    );

    embed.addFields({
      name: `${position}. \`${player.gamertag}\``,
      value: formattedTime,
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

/**
 * Handle /leaderboard timeplayed subcommand
 * @param {import('discord.js').CommandInteraction} interaction
 */
async function handleTimePlayedLeaderboard(interaction) {
  // Load all player stats
  const allStats = loadMockStats();

  // Convert stats object to array and filter out players with no activity
  const playerArray = Object.entries(allStats)
    .filter(
      ([gamertag, stats]) =>
        stats.kills > 0 ||
        stats.deaths > 0 ||
        (stats.accumulatedAliveMs ?? 0) > 0 ||
        (stats.accumulatedPlayedMs ?? 0) > 0,
    )
    .map(([gamertag, stats]) => ({
      gamertag,
      accumulatedPlayedMs: stats.accumulatedPlayedMs ?? 0,
    }));

  // Check if there are any stats
  if (playerArray.length === 0) {
    const emptyEmbed = new EmbedBuilder()
      .setColor(0x00ae86)
      .setTitle("Current Top 15 Play Time ⌚")
      .setDescription(
        `**${SERVER_NAME}**\n\nNo player stats available yet. Start playing to appear on the leaderboard!`,
      )
      .setTimestamp()
      .setFooter({
        text: `Bellok's Killfeed`,
      });

    await interaction.reply({
      embeds: [emptyEmbed],
      ephemeral: false,
    });
    return;
  }

  // Sort by accumulated played time descending
  playerArray.sort((a, b) => b.accumulatedPlayedMs - a.accumulatedPlayedMs);

  // Take top 15
  const top15 = playerArray.slice(0, 15);

  // Build the embed with 3-column layout using inline fields
  const embed = new EmbedBuilder()
    .setColor(0x00ae86)
    .setTitle("Current Top 15 Play Time ⌚")
    .setDescription(`**${SERVER_NAME}**`)
    .setTimestamp();

  // Add players as inline fields (3 per row)
  top15.forEach((player, index) => {
    const position = index + 1;
    const formattedTime = formatTimeAliveForLeaderboard(
      player.accumulatedPlayedMs,
    );

    embed.addFields({
      name: `${position}. \`${player.gamertag}\``,
      value: formattedTime,
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

/**
 * Format time alive from milliseconds for leaderboard display
 * @param {number} ms - Milliseconds alive
 * @returns {string} - Formatted time string (e.g., "03D 13H 36M", "21H 34M 42S", "00M")
 */
function formatTimeAliveForLeaderboard(ms) {
  if (ms === null || ms === undefined || ms < 0) return "00M";

  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  // Use days only when time is at least 1 day
  if (days > 0) {
    return `${String(days).padStart(2, "0")}D ${String(hours).padStart(2, "0")}H ${String(minutes).padStart(2, "0")}M`;
  }

  // Use seconds only when time is less than 1 day
  if (hours > 0 || minutes > 0 || seconds > 0) {
    return `${String(hours).padStart(2, "0")}H ${String(minutes).padStart(2, "0")}M ${String(seconds).padStart(2, "0")}S`;
  }

  // No time accumulated
  return "00M";
}

module.exports = {
  leaderboardCommand,
};
