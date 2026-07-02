# AI Context

This is an existing Node.js Discord bot for a DayZ PS5 server.

Current stack:
- Node.js
- discord.js
- axios
- dotenv
- pngjs
- JSON storage

Current state:
- The bot is in one large index.js file.
- It connects to Nitrado logs.
- It parses DayZ kill events.
- It posts kill feed embeds to Discord.
- It has an unfinished heatmap feature.
- There is no active Nitrado server right now.

Refactor rules:
- Do not add Express yet.
- Do not migrate to TypeScript yet.
- Do not change behavior unless asked.
- Keep CommonJS require/module.exports for now.
- Do not touch .env or secrets.
- Prefer small, safe refactors.
- Create mock log support so the bot can be tested without Nitrado.

Goal:
Make the bot easier to understand, test and extend with stats, leaderboards and heatmap fixes.