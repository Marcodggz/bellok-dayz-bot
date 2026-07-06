// src/features/commands/registerCommands.js — Register slash commands with Discord API

const { REST, Routes } = require("discord.js");
const { linkCommand, unlinkCommand } = require("./linkCommands");
const { statsCommand } = require("./statsCommand");

/**
 * Register slash commands with Discord
 * @param {string} discordToken - Discord bot token
 * @param {string} clientId - Discord application/client ID
 */
async function registerCommands(discordToken, clientId) {
  const commands = [
    linkCommand.data.toJSON(),
    unlinkCommand.data.toJSON(),
    statsCommand.data.toJSON(),
  ];

  const rest = new REST({ version: "10" }).setToken(discordToken);

  try {
    console.log(
      `[commands] Registering ${commands.length} slash command(s)...`,
    );

    // Register commands globally (may take up to 1 hour to propagate)
    // For instant registration during development, use guild-specific registration
    const data = await rest.put(Routes.applicationCommands(clientId), {
      body: commands,
    });

    console.log(
      `[commands] Successfully registered ${data.length} slash command(s)`,
    );
    return data;
  } catch (error) {
    console.error("[commands] Error registering slash commands:", error);
    throw error;
  }
}

/**
 * Register slash commands for a specific guild (instant, for development)
 * @param {string} discordToken - Discord bot token
 * @param {string} clientId - Discord application/client ID
 * @param {string} guildId - Discord guild/server ID
 */
async function registerGuildCommands(discordToken, clientId, guildId) {
  const commands = [
    linkCommand.data.toJSON(),
    unlinkCommand.data.toJSON(),
    statsCommand.data.toJSON(),
  ];

  const rest = new REST({ version: "10" }).setToken(discordToken);

  try {
    console.log(
      `[commands] Registering ${commands.length} guild-specific slash command(s)...`,
    );

    const data = await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      {
        body: commands,
      },
    );

    console.log(
      `[commands] Successfully registered ${data.length} guild-specific slash command(s)`,
    );
    return data;
  } catch (error) {
    console.error("[commands] Error registering guild slash commands:", error);
    throw error;
  }
}

module.exports = {
  registerCommands,
  registerGuildCommands,
};
