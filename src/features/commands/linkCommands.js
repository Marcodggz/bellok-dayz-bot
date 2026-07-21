// src/features/commands/linkCommands.js — Slash commands for linking Discord users to DayZ gamertags

const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const {
  linkGamertag,
  unlinkGamertag,
  getGamertagByDiscordUserId,
  getDiscordUserIdByGamertag,
} = require("../../storage/linkedGamertagsStore");
const {
  loadPlayerStats,
  findPlayerStats,
} = require("../../storage/playerStatsStore");

/**
 * Define the /link command
 */
const linkCommand = {
  data: new SlashCommandBuilder()
    .setName("link")
    .setDescription("Link your Discord account to your DayZ gamertag")
    .addStringOption((option) =>
      option
        .setName("gamertag")
        .setDescription("Your DayZ player name")
        .setRequired(true),
    ),

  /**
   * Execute the /link command
   * @param {import('discord.js').CommandInteraction} interaction
   */
  async execute(interaction) {
    const requestedGamertag = interaction.options
      .getString("gamertag")
      .trim();
    const userId = interaction.user.id;

    try {
      const existingGamertag = getGamertagByDiscordUserId(userId);
      const existingOwner = getDiscordUserIdByGamertag(requestedGamertag);

      if (existingOwner && existingOwner !== userId) {
        await interaction.reply({
          content: `❌ Gamertag **${requestedGamertag}** is already linked to another Discord account.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const playerResult = findPlayerStats(
        loadPlayerStats(),
        requestedGamertag,
      );
      const gamertag = playerResult
        ? playerResult.gamertag
        : requestedGamertag;

      linkGamertag(userId, gamertag);

      if (!playerResult) {
        await interaction.reply({
          content: `✅ Linked your account to gamertag **${gamertag}**. No statistics have been recorded for this player yet; they will appear after playing on the server.`,
          flags: MessageFlags.Ephemeral,
        });
      } else if (existingGamertag) {
        await interaction.reply({
          content: `✅ Updated your linked gamertag from **${existingGamertag}** to **${gamertag}**`,
          flags: MessageFlags.Ephemeral,
        });
      } else {
        await interaction.reply({
          content: `✅ Successfully linked your account to gamertag **${gamertag}**`,
          flags: MessageFlags.Ephemeral,
        });
      }
    } catch (error) {
      console.error("[link command error]", error);
      await interaction.reply({
        content: "❌ An error occurred while linking your gamertag.",
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};

/**
 * Define the /unlink command
 */
const unlinkCommand = {
  data: new SlashCommandBuilder()
    .setName("unlink")
    .setDescription("Unlink your Discord account from your DayZ gamertag"),

  /**
   * Execute the /unlink command
   * @param {import('discord.js').CommandInteraction} interaction
   */
  async execute(interaction) {
    const userId = interaction.user.id;

    try {
      // Check if user is linked
      const existingGamertag = getGamertagByDiscordUserId(userId);

      if (!existingGamertag) {
        await interaction.reply({
          content: "❌ You don't have a linked gamertag.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      // Unlink the gamertag
      unlinkGamertag(userId);

      await interaction.reply({
        content: `✅ Successfully unlinked your account from gamertag **${existingGamertag}**`,
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      console.error("[unlink command error]", error);
      await interaction.reply({
        content: "❌ An error occurred while unlinking your gamertag.",
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};

module.exports = {
  linkCommand,
  unlinkCommand,
};
