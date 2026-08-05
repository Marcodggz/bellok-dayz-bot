import type { PersistedPlayerStatsCollection } from "../types/domainPersistence.js";
import { Client, GatewayIntentBits } from "discord.js";

import * as config from "../config/config.js";
import { bufToText, looksLikeHtml, looksLikeRateLimit } from "../utils/helpers.js";
import { getHttpErrorDetails } from "../utils/httpErrors.js";
import { loadPlayerStats, savePlayerStats } from "../storage/playerStatsStore.js";
import {
  KILLFEED_FLUSH_INTERVAL_MS,
  flushKillfeedQueue,
} from "../features/killfeed/killfeedQueue.js";
import {
  handlePlayerConnect,
  handlePlayerDisconnect,
  resetStalePlayerSessions,
} from "../features/stats/playerStats.js";
import {
  createEventTimeNormalizer,
  processPlayerSessionLine,
} from "../features/stats/playerSessionProcessor.js";
import { processNonPvpDeathLine } from "../features/stats/nonPvpDeathProcessor.js";
import { updateAdmClock } from "../features/stats/admClock.js";
import { handleCommandInteraction } from "../features/commands/commandHandler.js";
import { registerCommands } from "../features/commands/registerCommands.js";
import { maybeSendWeekendHeatmap } from "../utils/weekendHeatmapHelpers.js";
import { addHeatPoint, maybeSendHeatmap } from "../utils/pvpHeatmapHelpers.js";
import { createHeatmapCycle } from "../utils/heatmapCycle.js";
import { startListCooldown } from "../api/nitradoClient.js";
import { ensureLatestAdmSelected, readNewLines } from "../features/polling/admFilePoller.js";
import { processKillEvents } from "../features/killfeed/killEventProcessor.js";
import { handleKillEvents } from "../features/killfeed/killEventHandler.js";

type AppConfig = typeof config;

function getErrorDetail(error: unknown): unknown {
  const { message } = getHttpErrorDetails(error);
  return message || error;
}

export function getEnvironmentError(mode: string, appConfig: AppConfig = config): string | null {
  if (
    !appConfig.NIT_TOKEN ||
    !appConfig.SERVICE_ID ||
    !appConfig.CHANNEL_ID ||
    !appConfig.DISCORD_TOKEN
  ) {
    return "Missing .env variables: NITRADO_TOKEN, NITRADO_SERVICE_ID, DISCORD_CHANNEL_ID, DISCORD_TOKEN";
  }

  if (!appConfig.ADM_DIR && mode === "run") {
    return "Missing NITRADO_ADM_DIR (should point to /noftp/.../dayzps/config)";
  }

  return null;
}

export function checkEnv(mode: string, appConfig: AppConfig = config): void {
  console.log(
    "[boot] .env",
    "DISCORD_TOKEN=",
    !!appConfig.DISCORD_TOKEN,
    "NITRADO_TOKEN=",
    !!appConfig.NIT_TOKEN,
    "SERVICE_ID=",
    !!appConfig.SERVICE_ID,
    "CHANNEL_ID=",
    !!appConfig.CHANNEL_ID,
    "ADM_DIR=",
    !!appConfig.ADM_DIR,
    "HEATMAP_CHANNEL_ID=",
    !!appConfig.HEATMAP_CHANNEL_ID
  );

  const environmentError = getEnvironmentError(mode, appConfig);

  if (environmentError) {
    console.error(environmentError);
    process.exit(1);
  }
}

export async function runBot(): Promise<void> {
  checkEnv("run");

  const discordToken = config.DISCORD_TOKEN;
  const channelId = config.CHANNEL_ID;

  if (!discordToken || !channelId) {
    throw new Error("Missing required Discord configuration");
  }

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  const stats: PersistedPlayerStatsCollection = loadPlayerStats();
  const normalizeEventTime = createEventTimeNormalizer();
  let readyOnce = false;

  const maybeRunHeatmapCycle = createHeatmapCycle({
    intervalMs: config.HEATMAP_INTERVAL_MS,
    runCycle: async () => {
      await maybeSendHeatmap(client);
      await maybeSendWeekendHeatmap(client);
    },
  });

  if (resetStalePlayerSessions(stats)) {
    savePlayerStats(stats);
  }

  async function tick(): Promise<void> {
    try {
      await maybeRunHeatmapCycle();

      const currentAdm = await ensureLatestAdmSelected();

      if (!currentAdm) {
        if (config.DEBUG_TICKS) {
          console.log("[tick] No current ADM file");
        }

        return;
      }

      const lines = await readNewLines(currentAdm);

      if (config.DEBUG_TICKS) {
        console.log(`[tick] ${new Date().toLocaleTimeString()}  +${lines.length} new lines`);
      }

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

      for (const position of heatmapPoints) {
        addHeatPoint(position.x, position.y);
      }
    } catch (error: unknown) {
      const { status, data, message } = getHttpErrorDetails(error);
      const text = bufToText(data);

      if (looksLikeHtml(text) || status === 429 || looksLikeRateLimit(text)) {
        if (startListCooldown(config.LIST_COOLDOWN_MS)) {
          console.warn("[tick] Nitrado busy; entering cooldown");
        }
      } else {
        console.warn("[tick] error:", status || "", (text || message).slice(0, 200));
      }
    }
  }

  client.once("clientReady", async () => {
    if (readyOnce) {
      return;
    }

    readyOnce = true;
    console.log(`✅ Bot online as ${client.user?.tag ?? "unknown user"}`);

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
    setInterval(tick, config.POLL_MS);

    setInterval(
      () => flushKillfeedQueue(client, channelId, config.DEBUG, config.RAW_TO_DISCORD),
      KILLFEED_FLUSH_INTERVAL_MS
    );

    console.log(
      `[killfeed] Flush interval started (every ${KILLFEED_FLUSH_INTERVAL_MS / 60000} minutes)`
    );
  });

  client.on("interactionCreate", handleCommandInteraction);

  client.login(discordToken).catch((error: unknown) => {
    console.error("[login error]", getErrorDetail(error));
    process.exit(1);
  });
}
