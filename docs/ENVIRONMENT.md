# Environment Configuration

Copy the template before running the bot:

```bash
cp .env.example .env
```

Do not commit `.env` or share its values publicly.

## Required Variables

| Variable             | Purpose                       |
| -------------------- | ----------------------------- |
| `NITRADO_SERVICE_ID` | Nitrado service identifier    |
| `NITRADO_TOKEN`      | Nitrado API token             |
| `NITRADO_ADM_DIR`    | Remote ADM log directory      |
| `DISCORD_TOKEN`      | Discord bot token             |
| `DISCORD_CLIENT_ID`  | Discord application client ID |
| `DISCORD_CHANNEL_ID` | Main killfeed channel         |
| `SERVER_NAME`        | Display name used in embeds   |

## Optional Discord Channels

| Variable                     | Purpose                         |
| ---------------------------- | ------------------------------- |
| `HEATMAP_CHANNEL_ID`         | PvP heatmap channel             |
| `WEEKEND_HEATMAP_CHANNEL_ID` | Player-location heatmap channel |

Leaving an optional channel ID empty disables that output.

## Polling and Behavior

| Variable                  | Example  | Purpose                                            |
| ------------------------- | -------- | -------------------------------------------------- |
| `START_AT_END`            | `1`      | Start from the current end of an existing ADM file |
| `RAW_TO_DISCORD`          | `0`      | Send matching raw ADM lines after embeds           |
| `DEBUG_KILLS`             | `0`      | Enable kill parsing logs                           |
| `DEBUG_TICKS`             | `0`      | Enable polling-cycle logs                          |
| `POLL_MS`                 | `5000`   | Main polling interval                              |
| `ROTATE_CHECK_MS`         | `60000`  | ADM rotation-check interval                        |
| `LIST_COOLDOWN_MS`        | `120000` | Cooldown after list/rate-limit failures            |
| `ADM_TIME_OFFSET_MINUTES` | `0`      | Offset applied to ADM timestamps                   |

Boolean-style variables use `1` for enabled and `0` for disabled.

## Shared Heatmap Settings

| Variable                  | Example  | Purpose                                     |
| ------------------------- | -------- | ------------------------------------------- |
| `HEATMAP_INTERVAL_MS`     | `900000` | PvP heatmap update interval                 |
| `HEATMAP_WIDTH`           | `2048`   | Output width when no base-map size is used  |
| `HEATMAP_HEIGHT`          | `2048`   | Output height when no base-map size is used |
| `HEATMAP_WINDOW_MIN`      | `15`     | PvP activity time window                    |
| `HEATMAP_RESET_ON_ROTATE` | `0`      | Reset PvP heat data after ADM rotation      |

## Map Settings

| Variable            | Example                | Purpose                    |
| ------------------- | ---------------------- | -------------------------- |
| `MAP_IMAGE_PATH`    | `./images/livonia.png` | Base map image             |
| `MAP_DISPLAY_NAME`  | `Livonia`              | Map name shown in Discord  |
| `IZURVIVE_MAP_SLUG` | `livonia`              | iZurvive map slug          |
| `MAP_SIZE`          | `12800`                | DayZ world-coordinate size |

## Map Calibration

| Variable                              | Purpose                                   |
| ------------------------------------- | ----------------------------------------- |
| `MAP_MIN_X` / `MAP_MAX_X`             | World X bounds                            |
| `MAP_MIN_Y` / `MAP_MAX_Y`             | World Y bounds                            |
| `MAP_FLIP_Y`                          | Reverse the vertical axis when set to `1` |
| `MAP_OFFSET_X` / `MAP_OFFSET_Y`       | Pixel-position adjustments                |
| `MAP_SCALE_X` / `MAP_SCALE_Y`         | Axis scaling                              |
| `MAP_PIX_INSET_L` / `MAP_PIX_INSET_R` | Left and right image insets               |
| `MAP_PIX_INSET_T` / `MAP_PIX_INSET_B` | Top and bottom image insets               |

## Heatmap Appearance

| Variable                 | Purpose                            |
| ------------------------ | ---------------------------------- |
| `HEAT_RADIUS`            | Optional radius override           |
| `HEAT_GAMMA`             | Intensity curve                    |
| `HEAT_MIN_ALPHA`         | Minimum visible opacity            |
| `HEAT_HALFLIFE_MIN`      | Time-decay half-life               |
| `HEAT_NORM_PERCENTILE`   | Intensity normalization percentile |
| `HEAT_RECENT_MIN`        | Recent-event time window           |
| `HEAT_RECENT_DOT_RADIUS` | Recent marker radius               |
| `HEAT_RECENT_DOT_ALPHA`  | Recent marker opacity              |

## Player-Location Heatmap

| Variable                      | Example                  | Purpose              |
| ----------------------------- | ------------------------ | -------------------- |
| `WEEKEND_HEATMAP_INTERVAL_MS` | `900000`                 | Update interval      |
| `WEEKEND_HEATMAP_WINDOW_MIN`  | `15`                     | Activity window      |
| `WEEKEND_HEATMAP_STATE_FILE`  | `./weekend-heatmap.json` | Runtime state path   |
| `WEEKEND_HEATMAP_IMG_PATH`    | `./weekend-heatmap.png`  | Generated image path |

## Runtime Files

The application creates local runtime files such as:

- `state.json`
- `heatmap.json`
- `heatmap.png`
- `weekend-heatmap.json`
- `weekend-heatmap.png`
- player statistics and linked-gamertag JSON files

These files are excluded by `.gitignore` and should not be committed.
