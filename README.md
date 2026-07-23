# Bellok’s Killfeed

[![Quality checks](https://github.com/Marcodggz/bellok-dayz-bot/actions/workflows/quality.yml/badge.svg?branch=main)](https://github.com/Marcodggz/bellok-dayz-bot/actions/workflows/quality.yml)
![Tests](https://img.shields.io/badge/tests-151%20passing-brightgreen)
![Node.js](https://img.shields.io/badge/Node.js-24-339933?logo=node.js&logoColor=white)
![Discord.js](https://img.shields.io/badge/discord.js-v14-5865F2?logo=discord&logoColor=white)

A modular Discord bot that turns DayZ PlayStation ADM logs into structured kill notifications, persistent player statistics, leaderboards, and visual heatmaps.

Built with Node.js, Discord.js, the Nitrado API, and PNG-based map rendering for a **DayZ Vanilla+** server.

## Project Highlights

- Incremental Nitrado ADM log polling
- PvP, melee, and explosion-event parsing
- Retryable Discord killfeed queue
- Persistent deduplication across restarts
- Player statistics, streaks, rankings, and alive time
- PvP and player-location heatmaps
- Atomic JSON persistence
- ESLint, Prettier, GitHub Actions, and **151 automated tests**

## Core Features

- **Killfeed:** parses supported ADM kill formats and sends structured Discord embeds.
- **Player data:** tracks kills, deaths, K/D, headshots, streaks, longest kills, ranks, and alive time.
- **Leaderboards:** exposes score, kills, deaths, K/D, headshots, streaks, longest-kill, and time-alive rankings.
- **Heatmaps:** renders PvP and player activity over calibrated Livonia and Chernarus maps.
- **Reliable polling:** handles byte offsets, file rotation, partial lines, API cooldowns, retries, and restart-safe deduplication.

## Architecture

```text
Nitrado ADM logs
        ↓
Incremental polling and line reconstruction
        ↓
Parsing, session tracking, and event grouping
        ↓
Persistent deduplication
        ↓
Statistics and heatmap updates
        ↓
Discord queue and embed delivery
```

The entry point acts as an orchestrator while API access, polling, parsing, storage, commands, statistics, killfeed handling, and rendering remain separated into focused modules.

Detailed documentation:

- [Architecture and technical decisions](docs/ARCHITECTURE.md)
- [Environment variables](docs/ENVIRONMENT.md)

## Tech Stack

- **Runtime:** Node.js 24, CommonJS
- **Discord:** discord.js v14
- **API:** Axios, Nitrado API
- **Rendering:** pngjs
- **Configuration:** dotenv
- **Testing:** Vitest
- **Quality:** ESLint, Prettier, GitHub Actions
- **Persistence:** local JSON with atomic writes

## Installation

### Requirements

- Node.js 24 or newer
- npm
- A Discord application and bot token
- A Nitrado DayZ PlayStation server
- Access to the server ADM log directory

```bash
git clone https://github.com/Marcodggz/bellok-dayz-bot.git
cd bellok-dayz-bot
nvm use
npm ci
cp .env.example .env
npm run register-commands
npm start
```

Fill in the required Discord and Nitrado values in `.env` before registering commands or starting the bot.

## Testing and CI

The project includes **151 tests across 18 test files**, covering parsing, polling, persistence, deduplication, Discord queueing, player statistics, and heatmap utilities.

Run the complete local quality pipeline:

```bash
npm run check
```

GitHub Actions runs installation, ESLint, Prettier, and Vitest on every push and pull request.

## Problems Solved

| Problem                        | Solution                                 |
| ------------------------------ | ---------------------------------------- |
| Duplicate kills after restart  | Persisted timestamped kill buckets       |
| Rotated or shortened ADM files | Rotation detection and safe offset reset |
| Lines split between downloads  | Persisted partial-line `carry`           |
| Failed Discord delivery        | Retryable killfeed queue                 |
| JSON corruption risk           | Atomic temporary-file writes             |
| Multiple ADM kill formats      | Normalized parser output                 |

## Security and Privacy

The repository excludes tokens, `.env`, runtime state, generated heatmaps, player databases, linked gamertags, real ADM logs, and private Discord channel identifiers.

`mock/sample-adm.txt` contains synthetic players, identifiers, and coordinates for development.

## Possible Next Steps

- Evaluate a gradual migration to TypeScript
- Evaluate whether JSON persistence remains appropriate as stored data grows
- Expand integration coverage for Discord and CLI workflows
- Add structured runtime logging
- Add schema validation for persisted state
- Add further player, clan, and time-based Discord commands
- Document deployment and operational workflows

## Behind the Name

**Bellok’s Killfeed** is named after Bella, the project’s cat supervisor, who contributed absolutely no code but maintained strict oversight throughout development.

## Author

**Marco Domínguez Gil**

Software engineer focused on JavaScript, Node.js, API integrations, automation, testing, and maintainable application architecture.
