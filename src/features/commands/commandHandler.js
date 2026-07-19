// src/features/commands/commandHandler.js — Handle slash command interactions

const { MessageFlags } = require("discord.js");
const { linkCommand, unlinkCommand } = require("./linkCommands");
const { statsCommand } = require("./statsCommand");
const { leaderboardCommand } = require("./leaderboardCommand");

// Map command names to their handlers
const commands = new Map([
  [linkCommand.data.name, linkCommand],
  [unlinkCommand.data.name, unlinkCommand],
  [statsCommand.data.name, statsCommand],
  [leaderboardCommand.data.name, leaderboardCommand],
]);

/**
 * Handle a slash command interaction
 * @param {import('discord.js').Interaction} interaction
 */
async function handleCommandInteraction(interaction) {
  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);

  if (!command) {
    console.warn(`[commands] Unknown command: ${interaction.commandName}`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(
      `[commands] Error executing ${interaction.commandName}:`,
      error,
    );

    // Try to send an error message to the user
    const errorMessage = {
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

module.exports = {
  handleCommandInteraction,
};
