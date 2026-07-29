// Slash command for player stats

import {
  AttachmentBuilder,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import {
  getDiscordUserIdByGamertag,
  getGamertagByDiscordUserId,
} from "../../storage/linkedGamertagsStore.js";
import { findPlayerStats, loadPlayerStats } from "../../storage/playerStatsStore.js";
import { SERVER_NAME } from "../../config/config.js";
import { getEstimatedAdmTimeMs } from "../stats/admClock.js";
import { getRankBadgePath } from "../../utils/rankBadges.js";
import type { PersistedPlayerStats } from "../../types/domainPersistence.js";

type StatsDisplayData = PersistedPlayerStats;

const MINIMUM_STATS_PLAYTIME_MS = 10 * 60 * 1000;

interface StatsEmbedResult {
  embed: EmbedBuilder;
  files: AttachmentBuilder[];
}

export function buildMissingStatsMessage(gamertag: string): string {
  return `❌ No statistics have been recorded for **${gamertag}** yet. Play on the server for at least 10 minutes, then try again.`;
}

export function buildUnknownPlayerMessage(serverName: string): string {
  return `❌ Specified gamertag does not exist on **${serverName}**!\nPlease check the spelling and try again.`;
}

export const statsCommand = {
  data: new SlashCommandBuilder()
    .setName("stats")
    .setDescription("View player statistics")
    .addStringOption((option) =>
      option
        .setName("player")
        .setDescription("Player gamertag (optional, uses your linked gamertag if not provided)")
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const playerOption = interaction.options.getString("player");
    const userId = interaction.user.id;

    try {
      let gamertag: string;

      if (playerOption) {
        gamertag = playerOption.trim();
      } else {
        const linkedGamertag = getGamertagByDiscordUserId(userId);

        if (!linkedGamertag) {
          await interaction.reply({
            content:
              "❌ You don't have a linked gamertag. Please use `/link gamertag` first, or provide a player name with `/stats player: Gamertag`",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        gamertag = linkedGamertag;
      }

      const allStats = loadPlayerStats();
      const playerResult = findPlayerStats(allStats, gamertag);

      if (!playerResult) {
        await interaction.reply({
          content: playerOption
            ? buildUnknownPlayerMessage(SERVER_NAME)
            : buildMissingStatsMessage(gamertag),
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      gamertag = playerResult.gamertag;
      const playerStats: StatsDisplayData = playerResult.stats;
      const estimatedAdmTimeMs = getEstimatedAdmTimeMs();
      const currentTimePlayedMs = calculateCurrentTimePlayedMs(playerStats, estimatedAdmTimeMs);

      if (currentTimePlayedMs < MINIMUM_STATS_PLAYTIME_MS) {
        await interaction.reply({
          content: buildMissingStatsMessage(gamertag),
        });
        return;
      }

      const linkedUserId = getDiscordUserIdByGamertag(gamertag);
      const discordDisplay = linkedUserId ? `<@${linkedUserId}>` : "Not Linked";

      const { embed, files } = buildStatsEmbed(
        gamertag,
        playerStats,
        discordDisplay,
        estimatedAdmTimeMs
      );

      await interaction.reply({
        embeds: [embed],
        files,
      });
    } catch (error: unknown) {
      console.error("[stats command error]", error);

      await interaction.reply({
        content: "❌ An error occurred while retrieving stats.",
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};

export function formatStatsDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || ms < 0) {
    return "N/A";
  }

  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${String(days).padStart(2, "0")}D ${String(hours).padStart(2, "0")}H ${String(minutes).padStart(2, "0")}M`;
  }

  return `${String(hours).padStart(2, "0")}H ${String(minutes).padStart(2, "0")}M ${String(seconds).padStart(2, "0")}S`;
}

export function calculateCurrentTimePlayedMs(
  stats: StatsDisplayData,
  estimatedAdmTimeMs: number | null
): number {
  let totalPlayedMs = stats.accumulatedPlayedMs ?? 0;

  if (
    stats.isConnected === true &&
    stats.connectedSince !== null &&
    stats.connectedSince !== undefined &&
    estimatedAdmTimeMs !== null
  ) {
    totalPlayedMs += Math.max(0, estimatedAdmTimeMs - stats.connectedSince);
  }

  return totalPlayedMs;
}

export function calculateCurrentTimeAliveMs(
  stats: StatsDisplayData,
  estimatedAdmTimeMs: number | null
): number | null {
  if (stats.isAlive === false) {
    return null;
  }

  let totalAliveMs = stats.accumulatedAliveMs ?? 0;

  if (
    stats.isConnected === true &&
    stats.connectedSince !== null &&
    stats.connectedSince !== undefined &&
    estimatedAdmTimeMs !== null
  ) {
    totalAliveMs += Math.max(0, estimatedAdmTimeMs - stats.connectedSince);
  }

  return totalAliveMs;
}

export function buildStatsEmbed(
  gamertag: string,
  stats: StatsDisplayData,
  discordDisplay: string,
  estimatedAdmTimeMs: number | null = getEstimatedAdmTimeMs()
): StatsEmbedResult {
  const rank = stats.rank ?? "Private";
  const score = (stats.score ?? 0).toFixed(1);
  const kills = stats.kills ?? 0;
  const deaths = stats.deaths ?? 0;
  const kd = (stats.kd ?? 0).toFixed(2);
  const headshots = stats.headshots ?? 0;
  const killStreak = stats.killStreak ?? 0;
  const bestKillStreak = stats.bestKillStreak ?? killStreak;
  const deathStreak = stats.deathStreak ?? 0;
  const worstDeathStreak = stats.worstDeathStreak ?? 0;
  const lastKill = stats.lastKill ?? "N/A";
  const lastDeath = stats.lastDeath ?? "N/A";
  const favouriteWeapon = stats.favouriteWeapon ?? "N/A";
  const longestKill = stats.longestKill ? `${stats.longestKill.toFixed(2)}m` : "N/A";
  const timePlayed = formatStatsDuration(stats.accumulatedPlayedMs);
  const bestTimeAlive = formatStatsDuration(stats.bestTimeAliveMs);
  const timeAlive = formatStatsDuration(calculateCurrentTimeAliveMs(stats, estimatedAdmTimeMs));

  const embed = new EmbedBuilder()
    .setColor(0x00ae86)
    .setTitle("📊 Player Stats 📊")
    .setDescription(`**${SERVER_NAME}**\n **Stats:** ${gamertag}`);

  const files: AttachmentBuilder[] = [];

  const rankBadgePath = getRankBadgePath(rank);

  if (rankBadgePath) {
    const attachment = new AttachmentBuilder(rankBadgePath, {
      name: "rank-badge.png",
    });

    files.push(attachment);
    embed.setThumbnail("attachment://rank-badge.png");
  }

  embed.addFields(
    {
      name: "\u200B",
      value: `**Rank:** ${rank}\n**Score:** ${score}\n**Discord:** ${discordDisplay}`,
      inline: false,
    },
    {
      name: "__PVP Stats__",
      value: `PVP Kills: **${kills}**\nPVP Deaths: **${deaths}**\nPVP KD: **${kd}**`,
      inline: true,
    },
    {
      name: "\u200B",
      value: "\u200B",
      inline: true,
    },
    {
      name: "__Death Stats__",
      value: `Deaths: **${deaths}**\nKD: **${kd}**`,
      inline: true,
    },
    {
      name: "__Streaks__",
      value: `Best Kill Streak: **${bestKillStreak}**\nKill Streak: **${killStreak}**\nWorst Death Streak: **${worstDeathStreak}**\nDeath Streak: **${deathStreak}**`,
      inline: true,
    },
    {
      name: "\u200B",
      value: "\u200B",
      inline: true,
    },
    {
      name: "__Enemy Stats__",
      value: `Last Kill: **${lastKill}**\nLast Death: **${lastDeath}**`,
      inline: true,
    },
    {
      name: "__Weapon Stats__",
      value: `Favourite Weapon: **${favouriteWeapon}**\nLongest Kill: **${longestKill}**\nHeadshots: **${headshots}**`,
      inline: false,
    },
    {
      name: "__Time Stats__",
      value: `Time Played: **${timePlayed}**\nBest Time Alive: **${bestTimeAlive}**\nTime Alive: **${timeAlive}**`,
      inline: false,
    }
  );

  embed.setFooter({
    text: `Bellok's Killfeed`,
  });
  embed.setTimestamp();

  return { embed, files };
}
