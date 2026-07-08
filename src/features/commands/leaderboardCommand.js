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
  // Load all player stats
  const allStats = loadMockStats();

  // Convert stats object to array and filter out players with no activity
  const playerArray = Object.entries(allStats)
    .filter(([gamertag, stats]) => stats.kills > 0 || stats.deaths > 0)
    .map(([gamertag, stats]) => ({
      gamertag,
      kills: stats.kills ?? 0,
    }));

  // Check if there are any stats
  if (playerArray.length === 0) {
    const emptyEmbed = new EmbedBuilder()
      .setColor(0x00ae86)
      .setTitle("Current Top 15 Kills 🔫")
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

  // Sort by kills descending
  playerArray.sort((a, b) => b.kills - a.kills);

  // Take top 15
  const top15 = playerArray.slice(0, 15);

  // Build the embed with 3-column layout using inline fields
  const embed = new EmbedBuilder()
    .setColor(0x00ae86)
    .setTitle("Current Top 15 Kills 🔫")
    .setDescription(`**${SERVER_NAME}**`)
    .setTimestamp();

  // Add players as inline fields (3 per row)
  top15.forEach((player, index) => {
    const position = index + 1;

    embed.addFields({
      name: `${position}. \`${player.gamertag}\``,
      value: `Kills: ${player.kills}`,
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
 * Handle /leaderboard deaths subcommand
 * @param {import('discord.js').CommandInteraction} interaction
 */
async function handleDeathsLeaderboard(interaction) {
  // Load all player stats
  const allStats = loadMockStats();

  // Convert stats object to array and filter out players with no activity
  const playerArray = Object.entries(allStats)
    .filter(([gamertag, stats]) => stats.kills > 0 || stats.deaths > 0)
    .map(([gamertag, stats]) => ({
      gamertag,
      deaths: stats.deaths ?? 0,
    }));

  // Check if there are any stats
  if (playerArray.length === 0) {
    const emptyEmbed = new EmbedBuilder()
      .setColor(0x00ae86)
      .setTitle("Current Top 15 Deaths ☠️")
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

  // Sort by deaths descending
  playerArray.sort((a, b) => b.deaths - a.deaths);

  // Take top 15
  const top15 = playerArray.slice(0, 15);

  // Build the embed with 3-column layout using inline fields
  const embed = new EmbedBuilder()
    .setColor(0x00ae86)
    .setTitle("Current Top 15 Deaths ☠️")
    .setDescription(`**${SERVER_NAME}**`)
    .setTimestamp();

  // Add players as inline fields (3 per row)
  top15.forEach((player, index) => {
    const position = index + 1;

    embed.addFields({
      name: `${position}. \`${player.gamertag}\``,
      value: `Deaths: ${player.deaths}`,
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
 * Handle /leaderboard kd subcommand
 * @param {import('discord.js').CommandInteraction} interaction
 */
async function handleKdLeaderboard(interaction) {
  // Load all player stats
  const allStats = loadMockStats();

  // Convert stats object to array and filter out players with no activity
  const playerArray = Object.entries(allStats)
    .filter(([gamertag, stats]) => stats.kills > 0 || stats.deaths > 0)
    .map(([gamertag, stats]) => ({
      gamertag,
      kd: stats.kd ?? 0,
    }));

  // Check if there are any stats
  if (playerArray.length === 0) {
    const emptyEmbed = new EmbedBuilder()
      .setColor(0x00ae86)
      .setTitle("Current Top 15 KD ⚔️")
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

  // Sort by KD descending
  playerArray.sort((a, b) => b.kd - a.kd);

  // Take top 15
  const top15 = playerArray.slice(0, 15);

  // Build the embed with 3-column layout using inline fields
  const embed = new EmbedBuilder()
    .setColor(0x00ae86)
    .setTitle("Current Top 15 KD ⚔️")
    .setDescription(`**${SERVER_NAME}**`)
    .setTimestamp();

  // Add players as inline fields (3 per row)
  top15.forEach((player, index) => {
    const position = index + 1;

    embed.addFields({
      name: `${position}. \`${player.gamertag}\``,
      value: `KD: ${player.kd.toFixed(2)}`,
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
 * Handle /leaderboard headshots subcommand
 * @param {import('discord.js').CommandInteraction} interaction
 */
async function handleHeadshotsLeaderboard(interaction) {
  // Load all player stats
  const allStats = loadMockStats();

  // Convert stats object to array and filter out players with no activity
  const playerArray = Object.entries(allStats)
    .filter(([gamertag, stats]) => stats.kills > 0 || stats.deaths > 0)
    .map(([gamertag, stats]) => ({
      gamertag,
      headshots: stats.headshots ?? 0,
    }));

  // Check if there are any stats
  if (playerArray.length === 0) {
    const emptyEmbed = new EmbedBuilder()
      .setColor(0x00ae86)
      .setTitle("Current Top 15 Headshots 🎯")
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

  // Sort by headshots descending
  playerArray.sort((a, b) => b.headshots - a.headshots);

  // Take top 15
  const top15 = playerArray.slice(0, 15);

  // Build the embed with 3-column layout using inline fields
  const embed = new EmbedBuilder()
    .setColor(0x00ae86)
    .setTitle("Current Top 15 Headshots 🎯")
    .setDescription(`**${SERVER_NAME}**`)
    .setTimestamp();

  // Add players as inline fields (3 per row)
  top15.forEach((player, index) => {
    const position = index + 1;

    embed.addFields({
      name: `${position}. \`${player.gamertag}\``,
      value: `Headshots: ${player.headshots}`,
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
 * Handle /leaderboard killstreak subcommand
 * @param {import('discord.js').CommandInteraction} interaction
 */
async function handleKillStreakLeaderboard(interaction) {
  // Load all player stats
  const allStats = loadMockStats();

  // Convert stats object to array and filter out players with no activity
  const playerArray = Object.entries(allStats)
    .filter(([gamertag, stats]) => stats.kills > 0 || stats.deaths > 0)
    .map(([gamertag, stats]) => ({
      gamertag,
      killStreak: stats.killStreak ?? 0,
    }));

  // Check if there are any stats
  if (playerArray.length === 0) {
    const emptyEmbed = new EmbedBuilder()
      .setColor(0x00ae86)
      .setTitle("Current Top 15 Kill Streaks 🔥")
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

  // Sort by kill streak descending
  playerArray.sort((a, b) => b.killStreak - a.killStreak);

  // Take top 15
  const top15 = playerArray.slice(0, 15);

  // Build the embed with 3-column layout using inline fields
  const embed = new EmbedBuilder()
    .setColor(0x00ae86)
    .setTitle("Current Top 15 Kill Streaks 🔥")
    .setDescription(`**${SERVER_NAME}**`)
    .setTimestamp();

  // Add players as inline fields (3 per row)
  top15.forEach((player, index) => {
    const position = index + 1;

    embed.addFields({
      name: `${position}. \`${player.gamertag}\``,
      value: `Kill Streak: ${player.killStreak}`,
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
 * Handle /leaderboard deathstreak subcommand
 * @param {import('discord.js').CommandInteraction} interaction
 */
async function handleDeathStreakLeaderboard(interaction) {
  // Load all player stats
  const allStats = loadMockStats();

  // Convert stats object to array and filter out players with no activity
  const playerArray = Object.entries(allStats)
    .filter(([gamertag, stats]) => stats.kills > 0 || stats.deaths > 0)
    .map(([gamertag, stats]) => ({
      gamertag,
      deathStreak: stats.deathStreak ?? 0,
    }));

  // Check if there are any stats
  if (playerArray.length === 0) {
    const emptyEmbed = new EmbedBuilder()
      .setColor(0x00ae86)
      .setTitle("Current Top 15 Death Streaks 💀")
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

  // Sort by death streak descending
  playerArray.sort((a, b) => b.deathStreak - a.deathStreak);

  // Take top 15
  const top15 = playerArray.slice(0, 15);

  // Build the embed with 3-column layout using inline fields
  const embed = new EmbedBuilder()
    .setColor(0x00ae86)
    .setTitle("Current Top 15 Death Streaks 💀")
    .setDescription(`**${SERVER_NAME}**`)
    .setTimestamp();

  // Add players as inline fields (3 per row)
  top15.forEach((player, index) => {
    const position = index + 1;

    embed.addFields({
      name: `${position}. \`${player.gamertag}\``,
      value: `Death Streak: ${player.deathStreak}`,
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
 * Handle /leaderboard longestkill subcommand
 * @param {import('discord.js').CommandInteraction} interaction
 */
async function handleLongestKillLeaderboard(interaction) {
  // Load all player stats
  const allStats = loadMockStats();

  // Convert stats object to array and filter out players with no activity
  const playerArray = Object.entries(allStats)
    .filter(([gamertag, stats]) => stats.kills > 0 || stats.deaths > 0)
    .map(([gamertag, stats]) => ({
      gamertag,
      longestKill: stats.longestKill ?? 0,
      longestKillWeapon: stats.longestKillWeapon ?? null,
    }));

  // Check if there are any stats
  if (playerArray.length === 0) {
    const emptyEmbed = new EmbedBuilder()
      .setColor(0x00ae86)
      .setTitle("Current Top 15 Longest Kills 🔭")
      .setDescription(`**${SERVER_NAME}**\n\nNo player stats available yet. Start playing to appear on the leaderboard!`)
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

  // Sort by longest kill descending
  playerArray.sort((a, b) => b.longestKill - a.longestKill);

  // Take top 15
  const top15 = playerArray.slice(0, 15);

  // Build the embed with 3-column layout using inline fields
  const embed = new EmbedBuilder()
    .setColor(0x00ae86)
    .setTitle("Current Top 15 Longest Kills 🔭")
    .setDescription(`**${SERVER_NAME}**`)
    .setTimestamp();

  // Add players as inline fields (3 per row)
  top15.forEach((player, index) => {
    const position = index + 1;
    const weapon = player.longestKillWeapon || "Unknown";
    const distance = player.longestKill ?? 0;

    embed.addFields({
      name: `${position}. \`${player.gamertag}\``,
      value: `${weapon} (${distance}m)`,
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
