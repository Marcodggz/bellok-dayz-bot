// src/features/commands/linkCommands.js — Slash commands for linking Discord users to DayZ gamertags

const { SlashCommandBuilder, MessageFlags } = require("discord.js");
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
