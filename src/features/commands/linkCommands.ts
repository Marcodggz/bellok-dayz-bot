// Slash commands for linking Discord users to DayZ gamertags

import { MessageFlags, SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import {
  getDiscordUserIdByGamertag,
  getGamertagByDiscordUserId,
  linkGamertag,
  unlinkGamertag,
} from "../../storage/linkedGamertagsStore";
import { findPlayerStats, loadPlayerStats } from "../../storage/playerStatsStore";

export const linkCommand = {
  data: new SlashCommandBuilder()
    .setName("link")
    .setDescription("Link your Discord account to your DayZ gamertag")
    .addStringOption((option) =>
      option.setName("gamertag").setDescription("Your DayZ player name").setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const requestedGamertag = interaction.options.getString("gamertag", true).trim();
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

      const allStats = loadPlayerStats();
      const playerResult = findPlayerStats(allStats, requestedGamertag);

      const gamertag = playerResult?.gamertag ?? requestedGamertag;

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
    } catch (error: unknown) {
      console.error("[link command error]", error);

      await interaction.reply({
        content: "❌ An error occurred while linking your gamertag.",
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};

export const unlinkCommand = {
  data: new SlashCommandBuilder()
    .setName("unlink")
    .setDescription("Unlink your Discord account from your DayZ gamertag"),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const userId = interaction.user.id;

    try {
      const existingGamertag = getGamertagByDiscordUserId(userId);

      if (!existingGamertag) {
        await interaction.reply({
          content: "❌ You don't have a linked gamertag.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      unlinkGamertag(userId);

      await interaction.reply({
        content: `✅ Successfully unlinked your account from gamertag **${existingGamertag}**`,
        flags: MessageFlags.Ephemeral,
      });
    } catch (error: unknown) {
      console.error("[unlink command error]", error);

      await interaction.reply({
        content: "❌ An error occurred while unlinking your gamertag.",
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
