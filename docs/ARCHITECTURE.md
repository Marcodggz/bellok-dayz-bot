# Architecture and Technical Decisions

## Overview

Bellok’s Killfeed is organized as a modular Node.js application. The main entry point coordinates Discord, Nitrado polling, parsing, storage, statistics, and heatmap rendering while most behavior lives in focused modules under `src/`.

## Data Flow

```text
Nitrado ADM logs
        ↓
Latest-file selection and incremental byte reads
        ↓
Partial-line reconstruction
        ↓
Kill parsing, session tracking, and position extraction
        ↓
Victim/time-bucket grouping
        ↓
Persistent deduplication
        ↓
Statistics and heatmap updates
        ↓
Discord queue and embed delivery
        ↓
Persist sent bucket
```

## Main Modules

- `src/api/` — Nitrado API requests, errors, cooldowns, and downloads
- `src/features/polling/` — ADM file selection, offsets, rotation, and partial-line handling
- `src/parsers/` — normalization of supported ADM kill formats
- `src/features/killfeed/` — event grouping, deduplication, embeds, and queueing
- `src/features/stats/` — persistent player statistics and session tracking
- `src/features/commands/` — Discord slash commands
- `src/features/tracking/` — player-position extraction
- `src/storage/` — JSON persistence and atomic writes
- `src/utils/` — heatmap rendering, coordinate conversion, and shared helpers

## Important Technical Decisions

### Incremental ADM Processing

The poller stores the last processed byte offset for each ADM file. This avoids downloading and reprocessing the complete log during every cycle.

If the current file becomes smaller, the poller treats it as a rotation or replacement and safely resumes from the beginning.

### Partial-Line Persistence

A Nitrado download may end in the middle of a line. The incomplete fragment is stored as `carry` and prepended to the next downloaded chunk before parsing.

### Event Grouping

Kill events use the victim and a 20-second time bucket as the deduplication key. When multiple event types refer to the same bucket, the PvP event receives priority over an explosion event.

### Persistent Deduplication

Sent buckets are stored in `state.json` with timestamps.

The implementation:

- loads sent buckets during startup;
- removes entries older than one hour;
- keeps at most 1,000 recent entries;
- prevents repeated queueing after restarts or ADM rereads;
- marks a bucket only after Discord accepts the main embed.

### Retryable Discord Queue

Kill events are queued before delivery. If Discord rejects the main embed, the event remains in memory for a later retry.

Optional raw-line delivery is isolated from the main embed so a raw-message failure does not resend an already delivered kill.

### Atomic JSON Writes

Runtime JSON files are written to a temporary file and then renamed over the destination. This reduces the chance of leaving corrupted state after interrupted writes.

### Local JSON Persistence

JSON remains appropriate for the current deployment size and keeps the project simple to operate. A database should be reconsidered if concurrent writes, larger datasets, advanced queries, or horizontal scaling become necessary.

### CommonJS

The project currently uses CommonJS to match the existing codebase and keep refactors incremental. A future TypeScript migration can be evaluated module by module.

## Testing Strategy

The test suite combines unit tests with focused CommonJS dependency stubs.

Covered behavior includes:

- Nitrado API responses and cooldowns;
- ADM parsing;
- offsets, rotation, and partial lines;
- kill grouping and priority;
- persistent deduplication after restart;
- Discord queue retries;
- player statistics and sessions;
- atomic JSON writes;
- coordinate mapping and heatmap helpers.

GitHub Actions runs `npm ci`, ESLint, Prettier, and Vitest on every push and pull request.
