import { AttachmentBuilder, EmbedBuilder } from "discord.js";
import { describe, expect, test } from "vitest";

import { buildHeatmapMessagePayload } from "../../src/utils/heatmapMessagePayload.ts";

describe("buildHeatmapMessagePayload", () => {
  test("removes previous attachments when there is no heatmap image", () => {
    const embed = new EmbedBuilder().setDescription("No activity");

    const payload = buildHeatmapMessagePayload({ embed });

    expect(payload).toEqual({
      content: "",
      embeds: [embed],
      attachments: [],
    });
    expect(payload).not.toHaveProperty("files");
  });

  test("includes the generated image when heatmap activity exists", () => {
    const embed = new EmbedBuilder().setDescription("Heatmap activity");
    const file = new AttachmentBuilder(Buffer.from("image"), {
      name: "heatmap.png",
    });

    const payload = buildHeatmapMessagePayload({ embed, file });

    expect(payload).toEqual({
      content: "",
      embeds: [embed],
      files: [file],
    });
    expect(payload).not.toHaveProperty("attachments");
  });
});
