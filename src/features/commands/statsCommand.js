// src/features/commands/statsCommand.js — Slash command for player stats

const { SlashCommandBuilder } = require("discord.js");
const {
  getGamertagByDiscordUserId,
  getDiscordUserIdByGamertag,
} = require("../../storage/linkedGamertagsStore");
const { loadMockStats } = require("../../storage/mockStatsStore");
const { SERVER_NAME } = require("../../config/config");

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
        .setDescription("Player gamertag (optional, uses your linked gamertag if not provided)")
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
            content: "❌ You don't have a linked gamertag. Please use `/link gamertag` first, or provide a player name with `/stats player: Gamertag`",
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

      // Format stats message
      const statsMessage = formatStatsMessage(gamertag, playerStats, discordDisplay);

      await interaction.reply({
        content: statsMessage,
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
 * Format stats into a message
 * @param {string} gamertag - Player gamertag
 * @param {Object} stats - Player stats object
 * @param {string} discordDisplay - Discord user mention or "Not Linked"
 * @returns {string} - Formatted stats message
 */
function formatStatsMessage(gamertag, stats, discordDisplay) {
  const rank = stats.rank || "Private";
  const score = stats.score ?? 0;
  const kills = stats.kills ?? 0;
  const deaths = stats.deaths ?? 0;
  const kd = stats.kd ?? 0;
  const headshots = stats.headshots ?? 0;
  const killStreak = stats.killStreak ?? 0;
  const bestKillStreak = stats.bestKillStreak ?? killStreak;
  const deathStreak = stats.deathStreak ?? 0;
  const worstDeathStreak = stats.worstDeathStreak ?? 0;
  const lastKill = stats.lastKill || "N/A";
  const lastDeath = stats.lastDeath || "N/A";
  const favouriteWeapon = stats.favouriteWeapon || "N/A";
  const longestKill = stats.longestKill || "N/A";
  const timePlayed = stats.timePlayed || "N/A";
  const bestTimeAlive = stats.bestTimeAlive || "N/A";
  const timeAlive = stats.timeAlive || stats.lastTimeAlive || "N/A";

  return `📊 **Player Stats** 📊
**${SERVER_NAME}**
**Stats:** ${gamertag}

**Rank:** ${rank}
**Score:** ${score}
**Discord:** ${discordDisplay}

**PVP Stats**
**PVP Kills:** ${kills}
**PVP Deaths:** ${deaths}
**PVP KD:** ${kd}

**Death Stats**
**Deaths:** ${deaths}
**KD:** ${kd}

**Streaks**
**Best Kill Streak:** ${bestKillStreak}
**Kill Streak:** ${killStreak}
**Worst Death Streak:** ${worstDeathStreak}
**Death Streak:** ${deathStreak}

**Enemy Stats**
**Last Kill:** ${lastKill}
**Last Death:** ${lastDeath}

**Weapon Stats**
**Favourite Weapon:** ${favouriteWeapon}
**Longest Kill:** ${longestKill}
**Headshots:** ${headshots}

**Time Stats**
**Time Played:** ${timePlayed}
**Best Time Alive:** ${bestTimeAlive}
**Time Alive:** ${timeAlive}`;
}

module.exports = {
  statsCommand,
};
