// CLI test and diagnostic handlers

import fs from "node:fs";
import { Client, EmbedBuilder, GatewayIntentBits } from "discord.js";

type AppConfig = typeof import("../config/config.js");
type CheckEnv = () => void;

type ListAdmNames = typeof import("../api/nitradoClient.js").listAdmNames;
type TsFromName = typeof import("../api/nitradoClient.js").tsFromName;
type NitDownload = typeof import("../api/nitradoClient.js").nitDownload;
type TMadrid = typeof import("../utils/helpers.js").tMadrid;
type ParseKill = typeof import("../parsers/killParser.js").parseKill;

type LoadMockStats = typeof import("../storage/mockStatsStore.js").loadMockStats;
type SaveMockStats = typeof import("../storage/mockStatsStore.js").saveMockStats;
type HandlePlayerConnect = typeof import("../features/stats/playerStats.js").handlePlayerConnect;
type HandlePlayerDisconnect =
  typeof import("../features/stats/playerStats.js").handlePlayerDisconnect;
type UpdateStatsFromEvent = typeof import("../features/stats/playerStats.js").updateStatsFromEvent;
type GetPlayerStats = typeof import("../features/stats/playerStats.js").getPlayerStats;
type FormatKillfeedNotification =
  typeof import("../features/killfeed/formatKillfeedNotification.js").formatKillfeedNotification;

type PlayerStats = import("../types/domainEvents.js").PlayerStats;
type PersistedPlayerStats = import("../types/domainPersistence.js").PersistedPlayerStats;

function getErrorDetail(error: unknown): unknown {
  if (typeof error !== "object" || error === null) {
    return error;
  }

  if ("code" in error && error.code) {
    return error.code;
  }

  if ("message" in error && typeof error.message === "string") {
    return error.message;
  }

  return error;
}

function requireConfigValue(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Missing required configuration: ${name}`);
  }

  return value;
}

function normalizePlayerStats(stats: PersistedPlayerStats | null): PlayerStats | null {
  if (!stats) {
    return null;
  }

  return {
    kills: stats.kills ?? 0,
    deaths: stats.deaths ?? 0,
    headshots: stats.headshots ?? 0,
    kd: stats.kd ?? 0,
    killStreak: stats.killStreak ?? 0,
    deathStreak: stats.deathStreak ?? 0,
    score: stats.score ?? 0,
    rank: stats.rank ?? "Private",
    longestKill: stats.longestKill ?? 0,
    longestKillWeapon: stats.longestKillWeapon ?? null,
    connectedSince: stats.connectedSince ?? null,
    accumulatedAliveMs: stats.accumulatedAliveMs ?? 0,
    isConnected: stats.isConnected ?? false,
    isAlive: stats.isAlive ?? true,
    lastTimeAlive: stats.lastTimeAlive ?? null,
    accumulatedPlayedMs: stats.accumulatedPlayedMs ?? 0,
  };
}

async function runDiscordTest(config: AppConfig, checkEnv: CheckEnv): Promise<void> {
  checkEnv();
  const channelId = requireConfigValue(config.CHANNEL_ID, "DISCORD_CHANNEL_ID");
  const discordToken = requireConfigValue(config.DISCORD_TOKEN, "DISCORD_TOKEN");
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  client.once("clientReady", async () => {
    try {
      const ch = await client.channels.fetch(channelId);

      if (!ch?.isSendable()) {
        throw new Error("Killfeed channel is unavailable or not sendable");
      }

      await ch.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0x22c55e)
            .setDescription("✅ Test: bot can send messages here")
            .setTimestamp(new Date()),
        ],
      });
      console.log("[discord-test] Message sent successfully to killfeed channel");
    } catch (e) {
      console.error("[discord-test] ERROR:", getErrorDetail(e));
    } finally {
      process.exit(0);
    }
  });
  client.login(discordToken).catch((e: unknown) => {
    console.error("[login error]", getErrorDetail(e));
    process.exit(1);
  });
}

async function runDiscordHeatmapTest(config: AppConfig, checkEnv: CheckEnv): Promise<void> {
  checkEnv();
  const channelId = requireConfigValue(config.HEATMAP_CHANNEL_ID, "HEATMAP_CHANNEL_ID");
  const discordToken = requireConfigValue(config.DISCORD_TOKEN, "DISCORD_TOKEN");
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  client.once("clientReady", async () => {
    try {
      const ch = await client.channels.fetch(channelId);

      if (!ch?.isSendable()) {
        throw new Error("Heatmap channel is unavailable or not sendable");
      }

      await ch.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0x3b82f6)
            .setDescription("🧪 Test: heatmap channel OK")
            .setTimestamp(new Date()),
        ],
      });
      console.log("[discord-heatmap-test] Message sent successfully to heatmap channel");
    } catch (e) {
      console.error("[discord-heatmap-test] ERROR:", getErrorDetail(e));
    } finally {
      process.exit(0);
    }
  });
  client.login(discordToken).catch((e: unknown) => {
    console.error("[login error]", getErrorDetail(e));
    process.exit(1);
  });
}

async function runDiagnose(
  config: AppConfig,
  checkEnv: CheckEnv,
  listAdmNames: ListAdmNames,
  tsFromName: TsFromName,
  tMadrid: TMadrid,
  nitDownload: NitDownload,
  parseKill: ParseKill
): Promise<void> {
  checkEnv();
  const admDir = requireConfigValue(config.ADM_DIR, "NITRADO_ADM_DIR");
  console.log("\n[diagnose] ADM directory:", admDir);
  const rows = await listAdmNames(admDir, true);
  if (!rows.length) {
    console.log("[diagnose] ❌ No ADM files listed (rate-limit or incorrect path)");
    process.exit(1);
  }
  console.log("[diagnose] Top 5 files:");
  for (const r of rows.slice(0, 5)) {
    const ts = tsFromName(r.name);
    console.log("  -", r.name, "→", ts ? tMadrid(ts) : "(no date)");
  }
  const latest = rows[0].path;
  console.log("[diagnose] Latest ADM:", latest);
  const dl = await nitDownload(latest);
  const buffer = dl.buffer;

  if (!buffer) {
    console.log("[diagnose] ❌ Could not download ADM file");
    process.exit(1);
  }

  const lines = buffer.toString("utf8").split(/\r?\n/).filter(Boolean);
  const tail = lines.slice(-40);
  console.log("\n[diagnose] Last 40 lines:\n" + tail.join("\n"));

  let pvp = 0,
    exp = 0;
  for (const ln of tail) {
    const e = parseKill(ln);
    if (e) {
      if (e.type === "pvp") pvp++;
      else if (e.type === "explosion") exp++;
    }
  }
  console.log(`\n[diagnose] Detected in tail → PvP: ${pvp}  Explosions: ${exp}`);
  process.exit(0);
}

async function runMockParse(
  parseKill: ParseKill,
  loadMockStats: LoadMockStats,
  saveMockStats: SaveMockStats,
  handlePlayerConnect: HandlePlayerConnect,
  handlePlayerDisconnect: HandlePlayerDisconnect,
  updateStatsFromEvent: UpdateStatsFromEvent,
  getPlayerStats: GetPlayerStats,
  formatKillfeedNotification: FormatKillfeedNotification
): Promise<void> {
  const mockLogPath = process.argv[3] || "./mock/sample-adm.txt";
  console.log(`[mock-parse] Reading ${mockLogPath}...\n`);

  if (!fs.existsSync(mockLogPath)) {
    console.error(`[mock-parse] ERROR: File not found: ${mockLogPath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(mockLogPath, "utf8");
  const lines = content.split(/\r?\n/).filter(Boolean);

  console.log(`[mock-parse] Total lines: ${lines.length}\n`);

  let pvpCount = 0;
  let explosionCount = 0;

  const stats = loadMockStats();
  console.log(
    `[mock-parse] Loaded stats for ${Object.keys(stats).length} players from persistent storage.\n`
  );

  // Midnight rollover tracking: detect when HH:MM:SS wraps from 23:59:59 → 00:00:00
  let previousRawTimeMs: number | null = null;
  let dayOffsetMs = 0;

  function parseRawTimeMs(timeStr: string | null): number | null {
    if (!timeStr) return null;
    const match = timeStr.match(/^(\d{2}):(\d{2}):(\d{2})$/);
    if (!match) return null;

    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const seconds = parseInt(match[3], 10);

    return (hours * 3600 + minutes * 60 + seconds) * 1000;
  }

  function getNormalizedEventTimeMs(timeStr: string | null): number | null {
    const rawTimeMs = parseRawTimeMs(timeStr);
    if (rawTimeMs === null) return null;

    // Detect midnight rollover: HH:MM:SS decreased from previous line
    if (previousRawTimeMs !== null && rawTimeMs < previousRawTimeMs) {
      dayOffsetMs += 86400000; // Add 24 hours in milliseconds
      console.log(
        `[mock-parse] Midnight rollover detected at ${timeStr}, dayOffset now: ${dayOffsetMs / 3600000}h`
      );
    }

    previousRawTimeMs = rawTimeMs;
    return dayOffsetMs + rawTimeMs;
  }

  for (const line of lines) {
    const timeMatch = line.match(/^\s*(\d{2}:\d{2}:\d{2})\s*\|/);
    const timeStr = timeMatch ? timeMatch[1] : null;
    const normalizedTimeMs = getNormalizedEventTimeMs(timeStr);

    const connectMatch = line.match(/Player\s+["'""](.+?)["'""].*?\(id=\d+\)\s+is connected/i);
    if (connectMatch) {
      const playerName = connectMatch[1].trim();
      handlePlayerConnect(stats, playerName, normalizedTimeMs);
      console.log(`🔌 CONNECT: ${playerName} connected at ${timeStr}`);
      continue;
    }

    const disconnectMatch = line.match(
      /Player\s+["'""](.+?)["'""].*?\(id=\d+\)\s+has been disconnected/i
    );
    if (disconnectMatch) {
      const playerName = disconnectMatch[1].trim();
      handlePlayerDisconnect(stats, playerName, normalizedTimeMs);
      console.log(`🔌 DISCONNECT: ${playerName} disconnected at ${timeStr}`);
      continue;
    }

    const event = parseKill(line);
    if (event) {
      updateStatsFromEvent(stats, event, normalizedTimeMs);

      console.log("✅ DETECTED:");
      console.log(`  Type: ${event.type}`);

      if (event.type === "pvp") {
        console.log(`  Killer: ${event.killer}`);
        console.log(`  Victim: ${event.victim}`);
        console.log(`  Weapon: ${event.weapon || "N/A"}`);
        console.log(
          `  Distance: ${event.distanceMeters ? event.distanceMeters + " meters" : "N/A"}`
        );
        console.log(`  Ammo: ${event.ammo || "N/A"}`);
        console.log(`  Hit Zone: ${event.hitZone || "N/A"}`);
        console.log(`  Damage: ${event.damage || "N/A"}`);

        if (event.killerPosition) {
          console.log(
            `  Killer Location: ${event.killerPosition.x.toFixed(1)};${event.killerPosition.y.toFixed(1)};${event.killerPosition.z.toFixed(1)}`
          );
        } else {
          console.log(`  Killer Location: N/A`);
        }

        if (event.victimPosition) {
          console.log(
            `  Victim Location: ${event.victimPosition.x.toFixed(1)};${event.victimPosition.y.toFixed(1)};${event.victimPosition.z.toFixed(1)}`
          );
        } else {
          console.log(`  Victim Location: N/A`);
        }

        console.log(`  Time: ${event.t || "N/A"}`);
        pvpCount++;
      } else if (event.type === "explosion") {
        console.log(`  Victim: ${event.victim}`);
        console.log(`  Device: ${event.device || "N/A"}`);

        if (event.victimPosition) {
          console.log(
            `  Location: ${event.victimPosition.x.toFixed(1)};${event.victimPosition.y.toFixed(1)};${event.victimPosition.z.toFixed(1)}`
          );
        } else {
          console.log(`  Location: N/A`);
        }

        console.log(`  Time: ${event.t || "N/A"}`);
        explosionCount++;
      }

      const killerStats =
        event.type === "pvp" && event.killer
          ? normalizePlayerStats(getPlayerStats(stats, event.killer))
          : null;

      const victimStats = event.victim
        ? normalizePlayerStats(getPlayerStats(stats, event.victim))
        : null;

      console.log("\n📋 FORMATTED KILLFEED NOTIFICATION:");
      console.log(formatKillfeedNotification(event, killerStats, victimStats));

      console.log("");
    } else {
      console.log("❌ No kill event:", line.slice(0, 80) + (line.length > 80 ? "..." : ""));
    }
  }

  console.log(
    `\n[mock-parse] Summary: ${pvpCount} PvP kills, ${explosionCount} explosions detected.`
  );

  saveMockStats(stats);
  console.log(
    `[mock-parse] Saved stats for ${Object.keys(stats).length} players to persistent storage.`
  );

  process.exit(0);
}

async function runDiscordWeekendHeatmapTest(config: AppConfig, checkEnv: CheckEnv): Promise<void> {
  checkEnv();
  const channelId = requireConfigValue(
    config.WEEKEND_HEATMAP_CHANNEL_ID,
    "WEEKEND_HEATMAP_CHANNEL_ID"
  );
  const discordToken = requireConfigValue(config.DISCORD_TOKEN, "DISCORD_TOKEN");
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  client.once("clientReady", async () => {
    try {
      const ch = await client.channels.fetch(channelId);

      if (!ch?.isSendable()) {
        throw new Error("Weekend heatmap channel is unavailable or not sendable");
      }

      await ch.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0x8b5cf6)
            .setDescription("🧪 Test: Weekend Heatmap channel OK")
            .setTimestamp(new Date()),
        ],
      });
      console.log(
        "[discord-weekend-heatmap-test] Message sent successfully to weekend heatmap channel"
      );
    } catch (e) {
      console.error("[discord-weekend-heatmap-test] ERROR:", getErrorDetail(e));
    } finally {
      process.exit(0);
    }
  });
  client.login(discordToken).catch((e: unknown) => {
    console.error("[login error]", getErrorDetail(e));
    process.exit(1);
  });
}

export {
  runDiscordTest,
  runDiscordHeatmapTest,
  runDiagnose,
  runMockParse,
  runDiscordWeekendHeatmapTest,
};
