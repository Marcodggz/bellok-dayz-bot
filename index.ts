// index.js — DayZ Nitrado PS4 → Discord Kill-feed + Heatmap
// - PvP kills: red embed with killer/victim/weapon details
// - Explosion deaths: orange embed
// - PvP Heatmap: single editable message with clustered death locations
// - Weekend Heatmap: single editable message with player position density (Fri-Sun only)
// - Coordinate calibration: min/max/offset/scale/flip for accurate map overlay

import type { PersistedPlayerStatsCollection } from "./src/types/domainPersistence.js";
import { Client, GatewayIntentBits } from "discord.js";

// Import config and helpers
import * as config from "./src/config/config.js";
import { bufToText, looksLikeHtml, looksLikeRateLimit, tMadrid } from "./src/utils/helpers.js";
import { getHttpErrorDetails } from "./src/utils/httpErrors.js";
import { loadMockStats, saveMockStats } from "./src/storage/mockStatsStore.js";
import { loadPlayerStats, savePlayerStats } from "./src/storage/playerStatsStore.js";
import { parseKill } from "./src/parsers/killParser.js";
import { formatKillfeedNotification } from "./src/features/killfeed/formatKillfeedNotification.js";
import {
  KILLFEED_FLUSH_INTERVAL_MS,
  flushKillfeedQueue,
} from "./src/features/killfeed/killfeedQueue.js";
import {
  getPlayerStats,
  handlePlayerConnect,
  handlePlayerDisconnect,
  resetStalePlayerSessions,
  updateStatsFromEvent,
} from "./src/features/stats/playerStats.js";
import {
  createEventTimeNormalizer,
  processPlayerSessionLine,
} from "./src/features/stats/playerSessionProcessor.js";
import { processNonPvpDeathLine } from "./src/features/stats/nonPvpDeathProcessor.js";
import { updateAdmClock } from "./src/features/stats/admClock.js";
import { handleCommandInteraction } from "./src/features/commands/commandHandler.js";
import { registerCommands } from "./src/features/commands/registerCommands.js";
import { maybeSendWeekendHeatmap } from "./src/utils/weekendHeatmapHelpers.js";
import { addHeatPoint, maybeSendHeatmap } from "./src/utils/pvpHeatmapHelpers.js";
import { createHeatmapCycle } from "./src/utils/heatmapCycle.js";
import {
  runDiagnose,
  runDiscordHeatmapTest,
  runDiscordTest,
  runDiscordWeekendHeatmapTest,
  runMockParse,
} from "./src/cli/index.js";
import {
  listAdmNames,
  nitDownload,
  startListCooldown,
  tsFromName,
} from "./src/api/nitradoClient.js";
import { ensureLatestAdmSelected, readNewLines } from "./src/features/polling/admFilePoller.js";
import { processKillEvents } from "./src/features/killfeed/killEventProcessor.js";
import { handleKillEvents } from "./src/features/killfeed/killEventHandler.js";

function getErrorDetail(error: unknown): unknown {
  const { message } = getHttpErrorDetails(error);
  return message || error;
}

const MODE = process.argv[2] || "run";

// Destructure config for convenience
const {
  SERVICE_ID,
  NIT_TOKEN,
  ADM_DIR,
  CHANNEL_ID,
  HEATMAP_CHANNEL_ID,
  RAW_TO_DISCORD,
  DEBUG,
  DEBUG_TICKS,
  POLL_MS,
  LIST_COOLDOWN_MS,
  HEATMAP_INTERVAL_MS,
} = config;

// ================== DISCORD / BOOT ==================
function checkEnv() {
  console.log(
    "[boot] .env",
    "DISCORD_TOKEN=",
    !!config.DISCORD_TOKEN,
    "NITRADO_TOKEN=",
    !!NIT_TOKEN,
    "SERVICE_ID=",
    !!SERVICE_ID,
    "CHANNEL_ID=",
    !!CHANNEL_ID,
    "ADM_DIR=",
    !!ADM_DIR,
    "HEATMAP_CHANNEL_ID=",
    !!HEATMAP_CHANNEL_ID
  );
  if (!NIT_TOKEN || !SERVICE_ID || !CHANNEL_ID || !config.DISCORD_TOKEN) {
    console.error(
      "Missing .env variables: NITRADO_TOKEN, NITRADO_SERVICE_ID, DISCORD_CHANNEL_ID, DISCORD_TOKEN"
    );
    process.exit(1);
  }
  if (!ADM_DIR && MODE === "run") {
    console.error("Missing NITRADO_ADM_DIR (should point to /noftp/.../dayzps/config)");
    process.exit(1);
  }
}

// ================== LOOP PRINCIPAL ==================
async function runBot(): Promise<void> {
  checkEnv();

  const discordToken = config.DISCORD_TOKEN;
  const channelId = CHANNEL_ID;

  if (!discordToken || !channelId) {
    throw new Error("Missing required Discord configuration");
  }

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  const stats: PersistedPlayerStatsCollection = loadPlayerStats();
  const normalizeEventTime = createEventTimeNormalizer();
  let readyOnce = false;

  const maybeRunHeatmapCycle = createHeatmapCycle({
    intervalMs: HEATMAP_INTERVAL_MS,
    runCycle: async () => {
      await maybeSendHeatmap(client);
      await maybeSendWeekendHeatmap(client);
    },
  });

  // Active sessions cannot safely continue across bot restarts because ADM
  // timestamps are normalized relative to the current process.
  if (resetStalePlayerSessions(stats)) {
    savePlayerStats(stats);
  }

  async function tick() {
    try {
      await maybeRunHeatmapCycle();

      const currentAdm = await ensureLatestAdmSelected();
      if (!currentAdm) {
        if (DEBUG_TICKS) console.log("[tick] No current ADM file");
        return;
      }

      const lines = await readNewLines(currentAdm);
      if (DEBUG_TICKS)
        console.log(`[tick] ${new Date().toLocaleTimeString()}  +${lines.length} new lines`);
      if (!lines.length) {
        return;
      }

      const normalizedEventTimes = new Map<string, number | null>();
      const groups = processKillEvents(lines);

      const processSessionLine = (line: string): void => {
        const sessionEvent = processPlayerSessionLine(
          line,
          stats,
          normalizeEventTime,
          handlePlayerConnect,
          handlePlayerDisconnect
        );

        normalizedEventTimes.set(line, sessionEvent.normalizedTimeMs);
        updateAdmClock(sessionEvent.normalizedTimeMs);
        processNonPvpDeathLine(line, stats, sessionEvent.normalizedTimeMs, groups.values());
      };

      const heatmapPoints = handleKillEvents(
        groups,
        lines,
        stats,
        normalizedEventTimes,
        processSessionLine
      );

      savePlayerStats(stats);

      for (const pos of heatmapPoints) {
        addHeatPoint(pos.x, pos.y);
      }
    } catch (error: unknown) {
      const { status, data, message } = getHttpErrorDetails(error);
      const txt = bufToText(data);
      if (looksLikeHtml(txt) || status === 429 || looksLikeRateLimit(txt)) {
        if (startListCooldown(LIST_COOLDOWN_MS)) {
          console.warn("[tick] Nitrado busy; entering cooldown");
        }
      } else {
        console.warn("[tick] error:", status || "", (txt || message).slice(0, 200));
      }
    }
  }

  client.once("clientReady", async () => {
    if (readyOnce) return;
    readyOnce = true;
    console.log(`✅ Bot online as ${client.user?.tag ?? "unknown user"}`);

    // Register slash commands
    if (config.CLIENT_ID) {
      try {
        await registerCommands(discordToken, config.CLIENT_ID);
      } catch (error) {
        console.warn("[commands] Failed to register slash commands:", getErrorDetail(error));
      }
    } else {
      console.warn("[commands] DISCORD_CLIENT_ID not set, skipping command registration");
    }

    await ensureLatestAdmSelected();
    setInterval(tick, POLL_MS);

    // Start killfeed flush interval (every 10 minutes)
    setInterval(
      () => flushKillfeedQueue(client, channelId, DEBUG, RAW_TO_DISCORD),
      KILLFEED_FLUSH_INTERVAL_MS
    );
    console.log(
      `[killfeed] Flush interval started (every ${KILLFEED_FLUSH_INTERVAL_MS / 60000} minutes)`
    );
  });

  // Handle slash command interactions
  client.on("interactionCreate", handleCommandInteraction);

  client.login(discordToken).catch((e: unknown) => {
    console.error("[login error]", getErrorDetail(e));
    process.exit(1);
  });
}

// ================== MAIN ==================
if (MODE === "discord-test") {
  runDiscordTest(config, checkEnv);
} else if (MODE === "discord-heatmap-test") {
  runDiscordHeatmapTest(config, checkEnv);
} else if (MODE === "discord-weekend-heatmap-test") {
  runDiscordWeekendHeatmapTest(config, checkEnv);
} else if (MODE === "diagnose") {
  runDiagnose(config, checkEnv, listAdmNames, tsFromName, tMadrid, nitDownload, parseKill);
} else if (MODE === "mock-parse") {
  runMockParse(
    parseKill,
    loadMockStats,
    saveMockStats,
    handlePlayerConnect,
    handlePlayerDisconnect,
    updateStatsFromEvent,
    getPlayerStats,
    formatKillfeedNotification
  );
} else {
  runBot();
}
