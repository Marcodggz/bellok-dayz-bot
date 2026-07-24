// Register slash commands with Discord API

import { REST, Routes } from "discord.js";

import { linkCommand, unlinkCommand } from "./linkCommands";
import { statsCommand } from "./statsCommand";
import { leaderboardCommand } from "./leaderboardCommand";

function buildCommandPayloads(): unknown[] {
  return [
    linkCommand.data.toJSON(),
    unlinkCommand.data.toJSON(),
    statsCommand.data.toJSON(),
    leaderboardCommand.data.toJSON(),
  ];
}

function ensureCommandRegistrationResult(data: unknown): unknown[] {
  if (!Array.isArray(data)) {
    throw new TypeError("Discord returned an invalid command registration response");
  }

  return data;
}

export async function registerCommands(discordToken: string, clientId: string): Promise<unknown[]> {
  const commands = buildCommandPayloads();
  const rest = new REST({ version: "10" }).setToken(discordToken);

  try {
    console.log(`[commands] Registering ${commands.length} slash command(s)...`);

    const response = await rest.put(Routes.applicationCommands(clientId), {
      body: commands,
    });
    const data = ensureCommandRegistrationResult(response);

    console.log(`[commands] Successfully registered ${data.length} slash command(s)`);

    return data;
  } catch (error: unknown) {
    console.error("[commands] Error registering slash commands:", error);
    throw error;
  }
}

export async function registerGuildCommands(
  discordToken: string,
  clientId: string,
  guildId: string
): Promise<unknown[]> {
  const commands = buildCommandPayloads();
  const rest = new REST({ version: "10" }).setToken(discordToken);

  try {
    console.log(`[commands] Registering ${commands.length} guild-specific slash command(s)...`);

    const response = await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
      body: commands,
    });
    const data = ensureCommandRegistrationResult(response);

    console.log(
      `[commands] Successfully registered ${data.length} guild-specific slash command(s)`
    );

    return data;
  } catch (error: unknown) {
    console.error("[commands] Error registering guild slash commands:", error);
    throw error;
  }
}
