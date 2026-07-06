#!/usr/bin/env node
// register-commands.js — Standalone script to register Discord slash commands

require("dotenv").config();
const { registerCommands } = require("./src/features/commands/registerCommands");

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;

if (!DISCORD_TOKEN) {
  console.error("❌ DISCORD_TOKEN not found in .env");
  process.exit(1);
}

if (!CLIENT_ID) {
  console.error("❌ DISCORD_CLIENT_ID not found in .env");
  process.exit(1);
}

console.log("🔧 Registering slash commands globally...");
console.log("⏳ Note: Global commands may take up to 1 hour to propagate\n");

registerCommands(DISCORD_TOKEN, CLIENT_ID)
  .then(() => {
    console.log("\n✅ Commands registered successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Failed to register commands:", error);
    process.exit(1);
  });
