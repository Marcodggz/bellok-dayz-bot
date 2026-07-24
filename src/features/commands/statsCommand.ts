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
} from "../../storage/linkedGamertagsStore";
import { findPlayerStats, loadPlayerStats } from "../../storage/playerStatsStore";
import { SERVER_NAME } from "../../config/config";
import { getRankBadgePath } from "../../utils/rankBadges";
import type {
  PersistedPlayerStats,
  PersistedPlayerStatsCollection,
  PlayerStatsSearchResult,
} from "../../types/domainPersistence";

interface StatsDisplayData extends PersistedPlayerStats {
  bestKillStreak?: number;
  worstDeathStreak?: number;
  lastKill?: string;
  lastDeath?: string;
  favouriteWeapon?: string;
  timePlayed?: string;
  bestTimeAlive?: string;
  timeAlive?: string;
}

interface StatsEmbedResult {
  embed: EmbedBuilder;
  files: AttachmentBuilder[];
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
        const linkedGamertag = getGamertagByDiscordUserId(userId) as string | null;

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

      const allStats = loadPlayerStats() as PersistedPlayerStatsCollection;
      const playerResult = findPlayerStats(allStats, gamertag) as PlayerStatsSearchResult | null;

      if (!playerResult) {
        await interaction.reply({
          content: `❌ No stats found for player **${gamertag}**`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      gamertag = playerResult.gamertag;
      const playerStats = playerResult.stats as StatsDisplayData;

      const linkedUserId = getDiscordUserIdByGamertag(gamertag) as string | null;
      const discordDisplay = linkedUserId ? `<@${linkedUserId}>` : "Not Linked";

      const { embed, files } = buildStatsEmbed(gamertag, playerStats, discordDisplay);

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

function buildStatsEmbed(
  gamertag: string,
  stats: StatsDisplayData,
  discordDisplay: string
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
  const timePlayed = stats.timePlayed ?? "N/A";
  const bestTimeAlive = stats.bestTimeAlive ?? "N/A";
  const timeAlive = stats.timeAlive ?? stats.lastTimeAlive ?? "N/A";

  const embed = new EmbedBuilder()
    .setColor(0x00ae86)
    .setTitle("📊 Player Stats 📊")
    .setDescription(`**${SERVER_NAME}**\n **Stats:** ${gamertag}`);

  const files: AttachmentBuilder[] = [];

  const rankBadgePath = getRankBadgePath(rank) as string | null;

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
