// Handle slash command interactions

import {
  MessageFlags,
  type ChatInputCommandInteraction,
  type Interaction,
  type InteractionReplyOptions,
} from "discord.js";

import { linkCommand, unlinkCommand } from "./linkCommands";
import { statsCommand } from "./statsCommand";
import { leaderboardCommand } from "./leaderboardCommand";

interface SlashCommand {
  data: {
    name: string;
  };
  execute(interaction: ChatInputCommandInteraction): Promise<unknown>;
}

const commands = new Map<string, SlashCommand>([
  [linkCommand.data.name, linkCommand],
  [unlinkCommand.data.name, unlinkCommand],
  [statsCommand.data.name, statsCommand],
  [leaderboardCommand.data.name, leaderboardCommand],
]);

export async function handleCommandInteraction(interaction: Interaction): Promise<void> {
  if (!interaction.isChatInputCommand()) {
    return;
  }

  const command = commands.get(interaction.commandName);

  if (!command) {
    console.warn(`[commands] Unknown command: ${interaction.commandName}`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error: unknown) {
    console.error(`[commands] Error executing ${interaction.commandName}:`, error);

    const errorMessage: InteractionReplyOptions = {
      content: "❌ An error occurred while executing this command.",
      flags: MessageFlags.Ephemeral,
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorMessage).catch(() => {});
    } else {
      await interaction.reply(errorMessage).catch(() => {});
    }
  }
}
