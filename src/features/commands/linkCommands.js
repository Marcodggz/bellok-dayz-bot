// src/features/commands/linkCommands.js — Slash commands for linking Discord users to DayZ gamertags

const { SlashCommandBuilder } = require("discord.js");
const {
  linkGamertag,
  unlinkGamertag,
  getGamertagByDiscordUserId,
} = require("../../storage/linkedGamertagsStore");

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
    const gamertag = interaction.options.getString("gamertag");
    const userId = interaction.user.id;

    try {
      // Check if user is already linked
      const existingGamertag = getGamertagByDiscordUserId(userId);

      // Link the gamertag
      linkGamertag(userId, gamertag);

      if (existingGamertag) {
        await interaction.reply({
          content: `✅ Updated your linked gamertag from **${existingGamertag}** to **${gamertag}**`,
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: `✅ Successfully linked your account to gamertag **${gamertag}**`,
          ephemeral: true,
        });
      }
    } catch (error) {
      console.error("[link command error]", error);
      await interaction.reply({
        content: "❌ An error occurred while linking your gamertag.",
        ephemeral: true,
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
          ephemeral: true,
        });
        return;
      }

      // Unlink the gamertag
      unlinkGamertag(userId);

      await interaction.reply({
        content: `✅ Successfully unlinked your account from gamertag **${existingGamertag}**`,
        ephemeral: true,
      });
    } catch (error) {
      console.error("[unlink command error]", error);
      await interaction.reply({
        content: "❌ An error occurred while unlinking your gamertag.",
        ephemeral: true,
      });
    }
  },
};

module.exports = {
  linkCommand,
  unlinkCommand,
};
