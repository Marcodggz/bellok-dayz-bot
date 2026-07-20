// src/cli/index.js - CLI test and diagnostic handlers

const fs = require("fs");
const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");

async function runDiscordTest(config, checkEnv) {
  checkEnv();
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  client.once("clientReady", async () => {
    try {
      const ch = await client.channels.fetch(config.CHANNEL_ID);
      await ch.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0x22c55e)
            .setDescription("✅ Test: bot can send messages here")
            .setTimestamp(new Date()),
        ],
      });
      console.log(
        "[discord-test] Message sent successfully to killfeed channel",
      );
    } catch (e) {
      console.error("[discord-test] ERROR:", e?.code || e?.message || e);
    } finally {
      process.exit(0);
    }
  });
  client.login(config.DISCORD_TOKEN).catch((e) => {
    console.error("[login error]", e?.message || e);
    process.exit(1);
  });
}

async function runDiscordHeatmapTest(config, checkEnv) {
  checkEnv();
  if (!config.HEATMAP_CHANNEL_ID) {
    console.error("Missing HEATMAP_CHANNEL_ID in .env");
    process.exit(1);
  }
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  client.once("clientReady", async () => {
    try {
      const ch = await client.channels.fetch(config.HEATMAP_CHANNEL_ID);
      await ch.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0x3b82f6)
            .setDescription("🧪 Test: heatmap channel OK")
            .setTimestamp(new Date()),
        ],
      });
      console.log(
        "[discord-heatmap-test] Message sent successfully to heatmap channel",
      );
    } catch (e) {
      console.error(
        "[discord-heatmap-test] ERROR:",
        e?.code || e?.message || e,
      );
    } finally {
      process.exit(0);
    }
  });
  client.login(config.DISCORD_TOKEN).catch((e) => {
    console.error("[login error]", e?.message || e);
    process.exit(1);
  });
}

async function runDiagnose(
  config,
  checkEnv,
  listAdmNames,
  tsFromName,
  tMadrid,
  nitDownload,
  parseKill,
) {
  checkEnv();
  console.log("\n[diagnose] ADM directory:", config.ADM_DIR);
  const rows = await listAdmNames(config.ADM_DIR, true);
  if (!rows.length) {
    console.log(
      "[diagnose] ❌ No ADM files listed (rate-limit or incorrect path)",
    );
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
  if (dl.error) {
    console.log("[diagnose] ❌ Could not download ADM file");
    process.exit(1);
  }
  const lines = dl.buffer.toString("utf8").split(/\r?\n/).filter(Boolean);
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
  console.log(
    `\n[diagnose] Detected in tail → PvP: ${pvp}  Explosions: ${exp}`,
  );
  process.exit(0);
}

async function runMockParse(
  parseKill,
  loadMockStats,
  saveMockStats,
  handlePlayerConnect,
  handlePlayerDisconnect,
  updateStatsFromEvent,
  getPlayerStats,
  formatKillfeedNotification,
) {
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
    `[mock-parse] Loaded stats for ${Object.keys(stats).length} players from persistent storage.\n`,
  );

  // Midnight rollover tracking: detect when HH:MM:SS wraps from 23:59:59 → 00:00:00
  let previousRawTimeMs = null;
  let dayOffsetMs = 0;

  function parseRawTimeMs(timeStr) {
    if (!timeStr) return null;
    const match = timeStr.match(/^(\d{2}):(\d{2}):(\d{2})$/);
    if (!match) return null;

    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const seconds = parseInt(match[3], 10);

    return (hours * 3600 + minutes * 60 + seconds) * 1000;
  }

  function getNormalizedEventTimeMs(timeStr) {
    const rawTimeMs = parseRawTimeMs(timeStr);
    if (rawTimeMs === null) return null;

    // Detect midnight rollover: HH:MM:SS decreased from previous line
    if (previousRawTimeMs !== null && rawTimeMs < previousRawTimeMs) {
      dayOffsetMs += 86400000; // Add 24 hours in milliseconds
      console.log(
        `[mock-parse] Midnight rollover detected at ${timeStr}, dayOffset now: ${dayOffsetMs / 3600000}h`,
      );
    }

    previousRawTimeMs = rawTimeMs;
    return dayOffsetMs + rawTimeMs;
  }

  for (const line of lines) {
    const timeMatch = line.match(/^\s*(\d{2}:\d{2}:\d{2})\s*\|/);
    const timeStr = timeMatch ? timeMatch[1] : null;
    const normalizedTimeMs = getNormalizedEventTimeMs(timeStr);

    const connectMatch = line.match(
      /Player\s+["'""](.+?)["'""].*?\(id=\d+\)\s+is connected/i,
    );
    if (connectMatch) {
      const playerName = connectMatch[1].trim();
      handlePlayerConnect(stats, playerName, normalizedTimeMs);
      console.log(`🔌 CONNECT: ${playerName} connected at ${timeStr}`);
      continue;
    }

    const disconnectMatch = line.match(
      /Player\s+["'""](.+?)["'""].*?\(id=\d+\)\s+has been disconnected/i,
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
          `  Distance: ${event.distanceMeters ? event.distanceMeters + " meters" : "N/A"}`,
        );
        console.log(`  Ammo: ${event.ammo || "N/A"}`);
        console.log(`  Hit Zone: ${event.hitZone || "N/A"}`);
        console.log(`  Damage: ${event.damage || "N/A"}`);

        if (event.killerPosition) {
          console.log(
            `  Killer Location: ${event.killerPosition.x.toFixed(1)};${event.killerPosition.y.toFixed(1)};${event.killerPosition.z.toFixed(1)}`,
          );
        } else {
          console.log(`  Killer Location: N/A`);
        }

        if (event.victimPosition) {
          console.log(
            `  Victim Location: ${event.victimPosition.x.toFixed(1)};${event.victimPosition.y.toFixed(1)};${event.victimPosition.z.toFixed(1)}`,
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
            `  Location: ${event.victimPosition.x.toFixed(1)};${event.victimPosition.y.toFixed(1)};${event.victimPosition.z.toFixed(1)}`,
          );
        } else {
          console.log(`  Location: N/A`);
        }

        console.log(`  Time: ${event.t || "N/A"}`);
        explosionCount++;
      }

      const killerStats = event.killer
        ? getPlayerStats(stats, event.killer)
        : null;
      const victimStats = event.victim
        ? getPlayerStats(stats, event.victim)
        : null;

      console.log("\n📋 FORMATTED KILLFEED NOTIFICATION:");
      console.log(formatKillfeedNotification(event, killerStats, victimStats));

      console.log("");
    } else {
      console.log(
        "❌ No kill event:",
        line.slice(0, 80) + (line.length > 80 ? "..." : ""),
      );
    }
  }

  console.log(
    `\n[mock-parse] Summary: ${pvpCount} PvP kills, ${explosionCount} explosions detected.`,
  );

  saveMockStats(stats);
  console.log(
    `[mock-parse] Saved stats for ${Object.keys(stats).length} players to persistent storage.`,
  );

  process.exit(0);
}

async function runDiscordWeekendHeatmapTest(config, checkEnv) {
  checkEnv();
  if (!config.WEEKEND_HEATMAP_CHANNEL_ID) {
    console.error("Missing WEEKEND_HEATMAP_CHANNEL_ID in .env");
    process.exit(1);
  }
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  client.once("clientReady", async () => {
    try {
      const ch = await client.channels.fetch(config.WEEKEND_HEATMAP_CHANNEL_ID);
      await ch.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0x8b5cf6)
            .setDescription("🧪 Test: Weekend Heatmap channel OK")
            .setTimestamp(new Date()),
        ],
      });
      console.log(
        "[discord-weekend-heatmap-test] Message sent successfully to weekend heatmap channel",
      );
    } catch (e) {
      console.error(
        "[discord-weekend-heatmap-test] ERROR:",
        e?.code || e?.message || e,
      );
    } finally {
      process.exit(0);
    }
  });
  client.login(config.DISCORD_TOKEN).catch((e) => {
    console.error("[login error]", e?.message || e);
    process.exit(1);
  });
}

module.exports = {
  runDiscordTest,
  runDiscordHeatmapTest,
  runDiagnose,
  runMockParse,
  runDiscordWeekendHeatmapTest,
};
