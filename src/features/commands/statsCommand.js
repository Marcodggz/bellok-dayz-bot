// src/features/commands/statsCommand.js — Slash command for player stats

const {
  SlashCommandBuilder,
  EmbedBuilder,
  AttachmentBuilder,
} = require("discord.js");
const {
  getGamertagByDiscordUserId,
  getDiscordUserIdByGamertag,
} = require("../../storage/linkedGamertagsStore");
const { loadMockStats } = require("../../storage/mockStatsStore");
const { SERVER_NAME } = require("../../config/config");
const { getRankBadgePath } = require("../../utils/rankBadges");

/**
 * Define the /stats command
 */
const statsCommand = {
  data: new SlashCommandBuilder()
    .setName("stats")
    .setDescription("View player statistics")
    .addStringOption((option) =>
      option
        .setName("player")
        .setDescription(
          "Player gamertag (optional, uses your linked gamertag if not provided)",
        )
        .setRequired(false),
    ),

  /**
   * Execute the /stats command
   * @param {import('discord.js').CommandInteraction} interaction
   */
  async execute(interaction) {
    const playerOption = interaction.options.getString("player");
    const userId = interaction.user.id;

    try {
      // Determine which gamertag to show stats for
      let gamertag;
      if (playerOption) {
        // Player specified a gamertag
        gamertag = playerOption.trim();
      } else {
        // No player specified, use linked gamertag
        gamertag = getGamertagByDiscordUserId(userId);
        if (!gamertag) {
          await interaction.reply({
            content:
              "❌ You don't have a linked gamertag. Please use `/link gamertag` first, or provide a player name with `/stats player: Gamertag`",
            ephemeral: true,
          });
          return;
        }
      }

      // Load mock player stats
      const allStats = loadMockStats();
      const playerStats = allStats[gamertag];

      if (!playerStats) {
        await interaction.reply({
          content: `❌ No stats found for player **${gamertag}**`,
          ephemeral: true,
        });
        return;
      }

      // Check if this player is linked to a Discord user
      const linkedUserId = getDiscordUserIdByGamertag(gamertag);
      const discordDisplay = linkedUserId ? `<@${linkedUserId}>` : "Not Linked";

      // Build stats embed
      const { embed: statsEmbed, files } = buildStatsEmbed(
        gamertag,
        playerStats,
        discordDisplay,
      );

      await interaction.reply({
        embeds: [statsEmbed],
        files: files,
        ephemeral: false,
      });
    } catch (error) {
      console.error("[stats command error]", error);
      await interaction.reply({
        content: "❌ An error occurred while retrieving stats.",
        ephemeral: true,
      });
    }
  },
};

/**
 * Build stats embed
 * @param {string} gamertag - Player gamertag
 * @param {Object} stats - Player stats object
 * @param {string} discordDisplay - Discord user mention or "Not Linked"
 * @returns {{embed: EmbedBuilder, files: Array}} - Discord embed with formatted stats and optional files
 */
function buildStatsEmbed(gamertag, stats, discordDisplay) {
  const rank = stats.rank || "Private";
  const score = (stats.score ?? 0).toFixed(1);
  const kills = stats.kills ?? 0;
  const deaths = stats.deaths ?? 0;
  const kd = (stats.kd ?? 0).toFixed(2);
  const headshots = stats.headshots ?? 0;
  const killStreak = stats.killStreak ?? 0;
  const bestKillStreak = stats.bestKillStreak ?? killStreak;
  const deathStreak = stats.deathStreak ?? 0;
  const worstDeathStreak = stats.worstDeathStreak ?? 0;
  const lastKill = stats.lastKill || "N/A";
  const lastDeath = stats.lastDeath || "N/A";
  const favouriteWeapon = stats.favouriteWeapon || "N/A";
  const longestKill = stats.longestKill
    ? `${stats.longestKill.toFixed(2)}m`
    : "N/A";
  const timePlayed = stats.timePlayed || "N/A";
  const bestTimeAlive = stats.bestTimeAlive || "N/A";
  const timeAlive = stats.timeAlive || stats.lastTimeAlive || "N/A";

  const embed = new EmbedBuilder()
    .setColor(0x00ae86)
    .setTitle("📊 Player Stats 📊")
    .setDescription(`**${SERVER_NAME}**\n **Stats:** ${gamertag}`);

  const files = [];

  // Try to add rank badge as thumbnail
  const rankBadgePath = getRankBadgePath(rank);
  if (rankBadgePath) {
    const attachment = new AttachmentBuilder(rankBadgePath, {
      name: "rank-badge.png",
    });
    files.push(attachment);
    embed.setThumbnail("attachment://rank-badge.png");
  }

  // Stats header with rank, score, discord (with blank line before)
  embed.addFields(
    {
      name: "\u200B",
      value: `**Rank:** ${rank}\n**Score:** ${score}\n**Discord:** ${discordDisplay}`,
      inline: false,
    },
    // First row: PVP Stats, horizontal spacer, Death Stats
    {
      name: "__PVP Stats__",
      value: `PVP Kills: **${kills}**\nPVP Deaths: **${deaths}**\nPVP KD: **${kd}**`,
      inline: true,
    },
    {
      name: "\u200B",
      value: "\u200B",
      inline: true,
    },
    {
      name: "__Death Stats__",
      value: `Deaths: **${deaths}**\nKD: **${kd}**`,
      inline: true,
    },
    // Second row: Streaks, horizontal spacer, Enemy Stats
    {
      name: "__Streaks__",
      value: `Best Kill Streak: **${bestKillStreak}**\nKill Streak: **${killStreak}**\nWorst Death Streak: **${worstDeathStreak}**\nDeath Streak: **${deathStreak}**`,
      inline: true,
    },
    {
      name: "\u200B",
      value: "\u200B",
      inline: true,
    },
    {
      name: "__Enemy Stats__",
      value: `Last Kill: **${lastKill}**\nLast Death: **${lastDeath}**`,
      inline: true,
    },
    // Full-width sections
    {
      name: "__Weapon Stats__",
      value: `Favourite Weapon: **${favouriteWeapon}**\nLongest Kill: **${longestKill}**\nHeadshots: **${headshots}**`,
      inline: false,
    },
    {
      name: "__Time Stats__",
      value: `Time Played: **${timePlayed}**\nBest Time Alive: **${bestTimeAlive}**\nTime Alive: **${timeAlive}**`,
      inline: false,
    },
  );

  // Add footer with bot name (timestamp is handled by .setTimestamp())
  embed.setFooter({
    text: `Bellok's Killfeed`,
  });
  embed.setTimestamp();

  return { embed, files };
}

module.exports = {
  statsCommand,
};
