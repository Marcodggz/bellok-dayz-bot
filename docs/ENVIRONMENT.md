# Environment Configuration

Bellok’s Killfeed reads its runtime configuration from environment variables through `dotenv`.

Create a local `.env` file from the tracked template:

```bash
cp .env.example .env
```

Never commit `.env` or expose Discord and Nitrado credentials publicly.

The values in `.env.example` are the configuration currently used and recommended for this Livonia setup. Some intentionally override the generic fallback values defined in `src/config/config.ts`. Values provided in `.env` take precedence.

## Required for Normal Bot Execution

The following variables must be configured when running the bot normally with `npm start`:

| Variable             | Purpose                    |
| -------------------- | -------------------------- |
| `NITRADO_SERVICE_ID` | Nitrado service identifier |
| `NITRADO_TOKEN`      | Nitrado API token          |
| `NITRADO_ADM_DIR`    | Remote ADM log directory   |
| `DISCORD_TOKEN`      | Discord bot token          |
| `DISCORD_CHANNEL_ID` | Main killfeed channel      |

`NITRADO_ADM_DIR` should point to the remote directory containing the DayZ PlayStation ADM files.

## Command Registration

| Variable            | Required for                      |
| ------------------- | --------------------------------- |
| `DISCORD_TOKEN`     | Authenticating with Discord       |
| `DISCORD_CLIENT_ID` | Registering global slash commands |

`DISCORD_CLIENT_ID` is required by:

```bash
npm run register-commands
```

It is not required merely to connect and run the bot after the commands have already been registered.

## Optional Discord Output

| Variable                     | Purpose                         |
| ---------------------------- | ------------------------------- |
| `HEATMAP_CHANNEL_ID`         | PvP activity heatmap channel    |
| `WEEKEND_HEATMAP_CHANNEL_ID` | Player-location heatmap channel |

Leaving either channel ID empty disables that output without preventing the main killfeed from running.

## Display Settings

| Variable            | Template value       | Purpose                                         |
| ------------------- | -------------------- | ----------------------------------------------- |
| `SERVER_NAME`       | `Bellok DayZ Server` | Display name shown in Discord command responses |
| `MAP_DISPLAY_NAME`  | `Livonia`            | Map name shown in Discord                       |
| `IZURVIVE_MAP_SLUG` | `livonia`            | Map segment used in location URLs               |

`Bellok DayZ Server` is the default display name and can be replaced with the public name of the DayZ server.

`SERVER_NAME`, `MAP_DISPLAY_NAME`, and `IZURVIVE_MAP_SLUG` all have internal fallback values.

## Polling and Runtime Behavior

| Variable                  | Template value | Purpose                                               |
| ------------------------- | -------------- | ----------------------------------------------------- |
| `START_AT_END`            | `1`            | Ignore existing ADM content on the first startup      |
| `RAW_TO_DISCORD`          | `0`            | Send the matching raw ADM line after a killfeed embed |
| `DEBUG_KILLS`             | `0`            | Enable kill-processing debug output                   |
| `DEBUG_TICKS`             | `0`            | Enable polling-cycle debug output                     |
| `POLL_MS`                 | `5000`         | Main polling interval                                 |
| `ROTATE_CHECK_MS`         | `60000`        | Minimum interval between ADM file-list refreshes      |
| `LIST_COOLDOWN_MS`        | `120000`       | Cooldown after Nitrado listing or rate-limit failures |
| `ADM_TIME_OFFSET_MINUTES` | `0`            | Offset applied when converting ADM kill timestamps    |

Boolean-style variables use `1` for enabled and `0` for disabled.

### `START_AT_END`

On the first ADM file selection after startup:

- `1` skips the content already present and processes only subsequently appended lines;
- `0` processes the existing ADM file from byte zero.

`1` is recommended for normal production use because it prevents historical events from being posted after a fresh installation or state reset. Using `0` can be useful for local tests, diagnostics, or rebuilding data from an existing ADM file.

Newly detected ADM files always begin at byte zero.

## PvP Heatmap

| Variable                  | Template value         | Purpose                                    |
| ------------------------- | ---------------------- | ------------------------------------------ |
| `HEATMAP_INTERVAL_MS`     | `900000`               | Minimum interval between heatmap cycles    |
| `HEATMAP_WINDOW_MIN`      | `15`                   | Age limit for retained PvP activity points |
| `HEATMAP_RESET_ON_ROTATE` | `0`                    | Clear PvP activity after ADM file rotation |
| `HEATMAP_WIDTH`           | `2048`                 | Canvas width without a readable base map   |
| `HEATMAP_HEIGHT`          | `2048`                 | Canvas height without a readable base map  |
| `MAP_IMAGE_PATH`          | `./images/livonia.png` | Base map image used for rendering          |

When the base map can be loaded, its dimensions replace `HEATMAP_WIDTH` and `HEATMAP_HEIGHT`.

The heatmap requires `HEATMAP_CHANNEL_ID` to send or update its Discord message.

## Player-Location Heatmap

| Variable                      | Template value           | Purpose                                 |
| ----------------------------- | ------------------------ | --------------------------------------- |
| `WEEKEND_HEATMAP_INTERVAL_MS` | `900000`                 | Minimum interval between update cycles  |
| `WEEKEND_HEATMAP_WINDOW_MIN`  | `15`                     | Age limit for retained player positions |
| `WEEKEND_HEATMAP_STATE_FILE`  | `./weekend-heatmap.json` | Persistent state path                   |
| `WEEKEND_HEATMAP_IMG_PATH`    | `./weekend-heatmap.png`  | Generated image path                    |

This heatmap records and displays player positions only on Friday, Saturday, and Sunday.

It requires `WEEKEND_HEATMAP_CHANNEL_ID` to send or update its Discord message.

## World Coordinates

| Variable     | Template value | Purpose                              |
| ------------ | -------------- | ------------------------------------ |
| `MAP_SIZE`   | `12800`        | DayZ world-coordinate size           |
| `MAP_MIN_X`  | `0`            | Minimum world X coordinate           |
| `MAP_MAX_X`  | `12800`        | Maximum world X coordinate           |
| `MAP_MIN_Y`  | `0`            | Minimum world Y coordinate           |
| `MAP_MAX_Y`  | `12800`        | Maximum world Y coordinate           |
| `MAP_FLIP_Y` | `1`            | Reverse the vertical coordinate axis |

The template values are calibrated for the included Livonia map.

## Map Calibration

| Variable                              | Template value | Purpose                       |
| ------------------------------------- | -------------- | ----------------------------- |
| `MAP_OFFSET_X`                        | `0`            | Horizontal pixel adjustment   |
| `MAP_OFFSET_Y`                        | `0`            | Vertical pixel adjustment     |
| `MAP_SCALE_X`                         | `1`            | Horizontal coordinate scaling |
| `MAP_SCALE_Y`                         | `1`            | Vertical coordinate scaling   |
| `MAP_PIX_INSET_L` / `MAP_PIX_INSET_R` | `8` / `8`      | Left and right image insets   |
| `MAP_PIX_INSET_T` / `MAP_PIX_INSET_B` | `8` / `34`     | Top and bottom image insets   |

The pixel inset values compensate for borders and labels embedded in the map image.

## Runtime Files

The bot creates or updates local runtime files including:

- `state.json`
- `heatmap.json`
- `heatmap.png`
- `weekend-heatmap.json`
- `weekend-heatmap.png`
- `data/player-stats.json`
- `data/linked-gamertags.json`
- `data/mock-player-stats.json`

The default state and heatmap paths are relative to the process working directory. Player statistics, gamertag links, and mock statistics are resolved from the project root.

These runtime files are excluded by `.gitignore` and must not be committed.

## Validation by Mode

Different execution modes require different subsets of the configuration:

| Mode                         | Additional requirement                    |
| ---------------------------- | ----------------------------------------- |
| Normal bot execution         | All normal runtime variables              |
| Slash-command registration   | `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`      |
| Killfeed Discord test        | `DISCORD_CHANNEL_ID`                      |
| PvP heatmap Discord test     | `HEATMAP_CHANNEL_ID`                      |
| Player-location heatmap test | `WEEKEND_HEATMAP_CHANNEL_ID`              |
| Nitrado diagnostic mode      | Nitrado credentials and `NITRADO_ADM_DIR` |
| Local mock parsing           | No live Nitrado or Discord connection     |
