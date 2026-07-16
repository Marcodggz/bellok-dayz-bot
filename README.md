# Bellok’s Killfeed

A modular Discord bot that transforms raw DayZ PlayStation server logs into real-time kill notifications, player statistics, leaderboards, and visual heatmaps.

Built with Node.js and integrated with the Nitrado and Discord APIs, the project handles continuous log polling, semi-structured data parsing, event deduplication, persistent player state, image generation, and automated testing.

The bot was developed for the **Last Survivor Vanilla+** DayZ PlayStation server.

## Project Highlights

* Processes live Nitrado ADM logs and publishes structured Discord notifications
* Parses multiple PvP and explosion-death log formats
* Prevents duplicate events using time-based victim buckets
* Tracks persistent player statistics, streaks, longest kills, and time alive
* Generates PvP and weekend activity heatmaps from world coordinates
* Handles ADM file rotation and temporary Nitrado API cooldowns
* Uses a modular architecture with separated parsing, processing, storage, API, and rendering layers
* Includes 94 automated tests covering critical application behavior

## Features

### Real-time Killfeed

PvP kills and explosion deaths are detected from Nitrado ADM logs and converted into formatted Discord embeds.

Kill events can include:

* Killer and victim
* Weapon
* Distance
* Hit zone
* Ammunition
* Damage
* Player coordinates

### Player Statistics

The bot maintains persistent statistics for each player, including:

* Kills and deaths
* K/D ratio
* Headshots
* Score and rank
* Current kill streak
* Current death streak
* Best kill streak
* Longest kill and weapon
* Accumulated time alive

### Discord Commands

Slash commands allow players to view personal statistics and server leaderboards.

Available leaderboard categories include:

* Score
* Kills
* Deaths
* K/D ratio
* Headshots
* Kill streak
* Death streak
* Longest kill
* Time alive

### Heatmaps

The project generates map overlays from DayZ world coordinates using `pngjs`.

It supports:

* PvP death-location heatmaps
* Time-window filtering
* Intensity normalization
* Recent-event markers
* Weekend player-activity heatmaps
* Soft bridges between consecutive player positions

### ADM Log Polling

The bot continuously checks Nitrado for the latest ADM file and reads only newly appended content.

The polling system handles:

* File rotation
* Stored byte offsets
* Partial lines between downloads
* Empty remote file lists
* API cooldowns and rate limits
* Local mock logs for development

## Architecture

The application is organized into focused modules under `src/`:

```text
src/
├── api/          Nitrado API communication and cooldown handling
├── cli/          Diagnostic, Discord test, heatmap test, and mock modes
├── config/       Environment-based configuration
├── features/
│   ├── commands/ Discord slash-command handlers
│   ├── killfeed/ Event processing, deduplication, embeds, and queueing
│   ├── polling/  ADM file selection, rotation, and incremental reading
│   ├── stats/    Player statistics and session tracking
│   └── tracking/ Player-position tracking
├── parsers/      ADM log parsing
├── storage/      JSON-based persistence
└── utils/        Heatmap rendering, coordinate mapping, and helpers
```

The main polling loop remains intentionally small and acts as an orchestrator between these modules.

## Event Flow

```text
Nitrado ADM log
      ↓
Incremental file polling
      ↓
Position updates and kill parsing
      ↓
Victim and time-bucket grouping
      ↓
Event deduplication
      ↓
Statistics and heatmap updates
      ↓
Discord killfeed queue
```

## Tech Stack

* **Node.js**
* **discord.js v14**
* **Axios**
* **pngjs**
* **Vitest**
* **CommonJS**
* **JSON persistence**

## Testing

The project currently contains **94 automated tests** across 8 test files.

Run all tests:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

### Test Coverage

Main tested areas include:

* **Kill Parser** — ADM log parsing for PvP and explosion events
* **Event Deduplication** — Prevention of duplicate kill notifications
* **Event Processor** — Event grouping and PvP prioritization
* **Event Handler** — Killfeed queueing and heatmap-coordinate extraction
* **Position Tracking** — Player-position tracking for heatmaps
* **ADM Polling** — Log rotation detection and incremental reading
* **Player Statistics** — Kills, deaths, streaks, longest kills, and alive time
* **Nitrado Client** — API communication, errors, rate limits, and cooldowns

Tests combine pure unit tests with focused dependency stubs for CommonJS modules.

The test suite also detected and helped fix an ADM rotation bug where a shortened file was incorrectly treated as having no new content.

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/Marcodggz/bellok-dayz-bot.git
cd bellok-dayz-bot
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the project root using the environment variables documented below.

Never commit the `.env` file or expose its values publicly.

### 4. Start the Bot

```bash
node index.js
```

## Environment Variables

### Nitrado

```text
NITRADO_SERVICE_ID
NITRADO_TOKEN
NITRADO_ADM_DIR
```

### Discord

```text
DISCORD_TOKEN
DISCORD_CLIENT_ID
DISCORD_CHANNEL_ID
HEATMAP_CHANNEL_ID
WEEKEND_HEATMAP_CHANNEL_ID
SERVER_NAME
```

### Polling

```text
START_AT_END
RAW_TO_DISCORD
DEBUG_KILLS
DEBUG_TICKS
POLL_MS
ROTATE_CHECK_MS
LIST_COOLDOWN_MS
```

### Heatmaps

```text
HEATMAP_INTERVAL_MS
HEATMAP_WIDTH
HEATMAP_HEIGHT
MAP_SIZE
HEATMAP_WINDOW_MIN
HEATMAP_RESET_ON_ROTATE
CHERNARUS_MAP_PATH
```

### Map Calibration

```text
MAP_MIN_X
MAP_MAX_X
MAP_MIN_Y
MAP_MAX_Y
MAP_FLIP_Y
MAP_OFFSET_X
MAP_OFFSET_Y
MAP_SCALE_X
MAP_SCALE_Y
```

Additional visual and weekend-heatmap settings are available in the project configuration.

## CLI Modes

Run a CLI mode with:

```bash
node index.js <mode>
```

| Mode                           | Purpose                                          |
| ------------------------------ | ------------------------------------------------ |
| `run`                          | Starts the Discord bot and Nitrado polling loop  |
| `discord-test`                 | Sends a test message to the killfeed channel     |
| `discord-heatmap-test`         | Tests the PvP heatmap channel                    |
| `discord-weekend-heatmap-test` | Tests the weekend heatmap channel                |
| `diagnose`                     | Inspects recent ADM files and parsed kill events |
| `mock-parse <path>`            | Processes a local ADM log without a live server  |

Examples:

```bash
node index.js diagnose
node index.js mock-parse ./mock/sample-adm.log
```

## Engineering Decisions

### Incremental Log Processing

The bot stores the last processed byte offset for each ADM file, avoiding repeated processing of the complete file during every polling cycle.

If the remote ADM file becomes smaller, the poller detects the rotation and safely resumes reading from the beginning.

### Event Deduplication

Kill events are grouped using the victim and a 20-second time bucket.

When an explosion event and a PvP event refer to the same victim bucket, the PvP event takes priority.

Processed buckets are temporarily stored to prevent repeated Discord notifications.

### Modular Refactor

The original application logic was gradually extracted from a large entry file into focused modules without intentionally changing the bot’s external behavior.

The resulting structure separates:

* API communication
* File polling
* Log parsing
* Event processing
* Discord output
* Statistics
* Position tracking
* Heatmap rendering
* Persistence

### Local JSON Persistence

JSON storage keeps the project simple to run while supporting persistent:

* Player statistics
* Polling state
* File offsets
* Linked Discord accounts
* PvP heatmap data
* Weekend heatmap data

### Controlled API Behavior

The Nitrado client detects:

* Rate-limit responses
* Temporary API failures
* HTML error responses
* Invalid download responses
* Active cooldown periods

When necessary, it applies a cooldown to avoid unnecessary repeated requests.

## Why This Project Matters

Bellok’s Killfeed demonstrates more than Discord command development.

It combines:

* Third-party API integration
* Semi-structured log parsing
* Stateful event processing
* Deduplication and prioritization logic
* Persistent data management
* Image generation
* Coordinate mapping
* Rate-limit and error handling
* Modular refactoring
* Automated regression testing

The project reflects the process of turning an idea for a real gaming community into a structured and maintainable Node.js application.

## Project Status

The core killfeed, statistics, leaderboard, polling, and heatmap systems are implemented and covered by automated tests.

The project is designed specifically for DayZ PlayStation servers hosted through Nitrado and depends on the availability and format of Nitrado ADM logs.

## Possible Next Steps

* Evaluate a gradual migration to TypeScript
* Add automated linting and formatting
* Add continuous integration to run tests on pull requests
* Evaluate whether JSON persistence remains appropriate as stored data grows
* Expand integration coverage for Discord and CLI workflows
* Add further player, clan, and time-based Discord commands

## Behind the Name

**Bellok’s Killfeed** is named after Bella, the project’s cat supervisor, who contributed absolutely no code but maintained strict oversight throughout development.
