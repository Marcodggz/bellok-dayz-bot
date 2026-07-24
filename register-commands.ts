#!/usr/bin/env node
// Standalone script to register Discord slash commands

import "dotenv/config";

import { registerCommands } from "./src/features/commands/registerCommands";

const discordToken = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;

if (!discordToken) {
  console.error("❌ DISCORD_TOKEN not found in .env");
  process.exit(1);
}

if (!clientId) {
  console.error("❌ DISCORD_CLIENT_ID not found in .env");
  process.exit(1);
}

console.log("🔧 Registering slash commands globally...");
console.log("⏳ Note: Global commands may take up to 1 hour to propagate\n");

registerCommands(discordToken, clientId)
  .then(() => {
    console.log("\n✅ Commands registered successfully!");
    process.exit(0);
  })
  .catch((error: unknown) => {
    console.error("\n❌ Failed to register commands:", error);
    process.exit(1);
  });
