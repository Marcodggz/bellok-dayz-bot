import type {
  AttachmentBuilder,
  EmbedBuilder,
  MessageCreateOptions,
  MessageEditOptions,
} from "discord.js";

interface HeatmapMessagePayloadOptions {
  embed: EmbedBuilder;
  file?: AttachmentBuilder;
}

export function buildHeatmapMessagePayload({
  embed,
  file,
}: HeatmapMessagePayloadOptions): MessageCreateOptions & MessageEditOptions {
  if (file) {
    return {
      content: "",
      embeds: [embed],
      files: [file],
    };
  }

  return {
    content: "",
    embeds: [embed],
    attachments: [],
  };
}
