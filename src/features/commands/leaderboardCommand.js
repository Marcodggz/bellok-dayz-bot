// src/features/commands/leaderboardCommand.js — Slash command for leaderboards

const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const {
  loadPlayerStatsForLeaderboard,
  getTopPlayers,
  replyLeaderboard,
} = require("./leaderboardHelpers");

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
          flags: MessageFlags.Ephemeral,
        });
      }
    } catch (error) {
      console.error("[leaderboard command error]", error);
      await interaction.reply({
        content: "❌ An error occurred while retrieving the leaderboard.",
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};

/**
 * Handle /leaderboard rank subcommand
 * @param {import('discord.js').CommandInteraction} interaction
 */
async function handleRankLeaderboard(interaction) {
  const allStats = loadPlayerStatsForLeaderboard();

  const playerArray = Object.entries(allStats)
    .filter(([, stats]) => stats.kills > 0 || stats.deaths > 0)
    .map(([gamertag, stats]) => ({
      gamertag,
      score: stats.score ?? 0,
      rank: stats.rank || "Private",
    }));

  const top15 = getTopPlayers(playerArray, (a, b) => b.score - a.score);

  await replyLeaderboard(
    interaction,
    "Current Top 15 Ranks 🏅",
    top15,
    (player) => `Rank: ${player.rank}\nScore: ${player.score.toFixed(1)}`,
  );
}

/**
 * Handle /leaderboard kills subcommand
 * @param {import('discord.js').CommandInteraction} interaction
 */
async function handleKillsLeaderboard(interaction) {
  const allStats = loadPlayerStatsForLeaderboard();

  const playerArray = Object.entries(allStats)
    .filter(([, stats]) => stats.kills > 0 || stats.deaths > 0)
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
    .filter(([, stats]) => stats.kills > 0 || stats.deaths > 0)
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
    .filter(([, stats]) => stats.kills > 0 || stats.deaths > 0)
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
    .filter(([, stats]) => stats.kills > 0 || stats.deaths > 0)
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
    .filter(([, stats]) => stats.kills > 0 || stats.deaths > 0)
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
    .filter(([, stats]) => stats.kills > 0 || stats.deaths > 0)
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
    .filter(([, stats]) => stats.kills > 0 || stats.deaths > 0)
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
  const allStats = loadPlayerStatsForLeaderboard();

  const playerArray = Object.entries(allStats)
    .filter(
      ([, stats]) =>
        stats.kills > 0 ||
        stats.deaths > 0 ||
        (stats.accumulatedAliveMs ?? 0) > 0,
    )
    .map(([gamertag, stats]) => ({
      gamertag,
      accumulatedAliveMs: stats.accumulatedAliveMs ?? 0,
    }));

  const top15 = getTopPlayers(
    playerArray,
    (a, b) => b.accumulatedAliveMs - a.accumulatedAliveMs,
  );

  await replyLeaderboard(
    interaction,
    "Current Top 15 Lives ⏳",
    top15,
    (player) => formatTimeAliveForLeaderboard(player.accumulatedAliveMs),
  );
}

/**
 * Handle /leaderboard timeplayed subcommand
 * @param {import('discord.js').CommandInteraction} interaction
 */
async function handleTimePlayedLeaderboard(interaction) {
  const allStats = loadPlayerStatsForLeaderboard();

  const playerArray = Object.entries(allStats)
    .filter(
      ([, stats]) =>
        stats.kills > 0 ||
        stats.deaths > 0 ||
        (stats.accumulatedAliveMs ?? 0) > 0 ||
        (stats.accumulatedPlayedMs ?? 0) > 0,
    )
    .map(([gamertag, stats]) => ({
      gamertag,
      accumulatedPlayedMs: stats.accumulatedPlayedMs ?? 0,
    }));

  const top15 = getTopPlayers(
    playerArray,
    (a, b) => b.accumulatedPlayedMs - a.accumulatedPlayedMs,
  );

  await replyLeaderboard(
    interaction,
    "Current Top 15 Play Time ⌚",
    top15,
    (player) => formatTimeAliveForLeaderboard(player.accumulatedPlayedMs),
  );
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
