# Bellok’s Killfeed

[![Quality checks](https://github.com/Marcodggz/bellok-dayz-bot/actions/workflows/quality.yml/badge.svg?branch=main)](https://github.com/Marcodggz/bellok-dayz-bot/actions/workflows/quality.yml)
![Tests](https://img.shields.io/badge/tests-308%20passing-brightgreen)
![Node.js](https://img.shields.io/badge/Node.js-24-339933?logo=node.js&logoColor=white)
![Discord.js](https://img.shields.io/badge/discord.js-v14-5865F2?logo=discord.js&logoColor=white)

A production-style Discord bot that transforms raw DayZ PlayStation server logs into a live killfeed, persistent player statistics, leaderboards, and activity heatmaps.

Built with strict TypeScript, Node.js, Discord.js, the Nitrado API, and an automated quality pipeline.

## Preview

### Live PvP Killfeed

<img src="docs/images/killfeed-preview.png" alt="Bellok's Killfeed PvP notification showing weapon, distance, hit details, location, and player statistics" width="520">

### Player Statistics

<img src="docs/images/stats-preview.png" alt="Bellok's Killfeed player statistics command showing PvP, streak, weapon, and playtime statistics" width="520">

### PvP Activity Heatmap

<img src="docs/images/heatmap-preview.png" alt="Bellok's Killfeed PvP activity heatmap for Livonia" width="520">

## What It Does

Bellok’s Killfeed continuously reads ADM logs from a Nitrado-hosted DayZ server and converts low-level game events into useful Discord features:

- structured PvP, melee, explosion, and non-PvP death notifications;
- persistent player statistics and PlayStation gamertag linking;
- leaderboards for kills, deaths, K/D, streaks, headshots, distance, and playtime;
- PvP and player-location heatmaps for Livonia and Chernarus;
- player session, playtime, and life-cycle tracking;
- local diagnostic and mock modes for safer development.

## Engineering Highlights

The project handles operational problems found in real server logs rather than assuming perfect input:

- incremental ADM downloads instead of repeatedly processing complete files;
- safe handling of file rotation and lines split between downloads;
- persistent deduplication to prevent repeated kills after restarts;
- retryable Discord delivery without duplicating successful messages;
- atomic JSON writes to reduce persistence corruption risk;
- cached PNG base maps to avoid repeated synchronous decoding;
- strict TypeScript with no `any` in the source code;
- **308 automated tests across 34 test files**;
- GitHub Actions validation on every push and pull request.

## Tech Stack

- **Language:** TypeScript with `strict: true`
- **Runtime:** Node.js 24
- **Discord integration:** discord.js v14
- **API integration:** Axios and the Nitrado API
- **Image rendering:** pngjs
- **Persistence:** local JSON with atomic writes
- **Testing:** Vitest
- **Quality:** ESLint, Prettier, TypeScript, and GitHub Actions
- **Build output:** CommonJS JavaScript in `dist`

## Quick Start

```bash
git clone https://github.com/Marcodggz/bellok-dayz-bot.git
cd bellok-dayz-bot
nvm use
npm ci
cp .env.example .env
```

Add the required Discord and Nitrado values to `.env`, then run:

```bash
npm start
```

See [Environment Configuration](docs/ENVIRONMENT.md) for the complete setup and variable reference.

## Discord Commands

- `/link` — link a Discord account to a PlayStation gamertag
- `/unlink` — remove the current link
- `/stats` — display persistent player statistics
- `/leaderboard` — display top-15 rankings across supported statistics

## Quality Checks

Run the complete local verification with:

```bash
npm run check
npm run typecheck
npm run build
```

## Documentation

- [Architecture and Technical Decisions](docs/ARCHITECTURE.md) — system flow, modules, persistence, parsing, delivery, heatmaps, testing, and CLI modes
- [Environment Configuration](docs/ENVIRONMENT.md) — required variables, optional features, map calibration, runtime files, and execution requirements

## Behind the Name

**Bellok’s Killfeed** is named after Bella, the project’s cat supervisor, who contributed absolutely no code but maintained strict oversight throughout development.

## Author

**Marco Domínguez Gil**

Software engineer focused on TypeScript, Node.js, API integrations, automation, testing, and maintainable application architecture.
