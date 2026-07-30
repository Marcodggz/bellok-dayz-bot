import fs from "node:fs";
import { AttachmentBuilder, EmbedBuilder, type Client } from "discord.js";
import { PNG } from "pngjs";

import {
  HEATMAP_CHANNEL_ID,
  HEATMAP_HEIGHT,
  HEATMAP_WIDTH,
  HEATMAP_WINDOW_MIN,
  HEAT_IMG_PATH,
  MAP_DISPLAY_NAME,
  MAP_IMAGE_PATH,
  MAP_SIZE,
} from "../config/config.js";
import { loadHeat, saveHeat } from "../storage/heatStore.js";
import type { HeatPoint, HeatState } from "../types/domainHeatmap.js";
import { mapToPixelCoords } from "./coordinateMapper.js";
import { buildHeatmapMessagePayload } from "./heatmapMessagePayload.js";
import {
  buildHeatClusters,
  composeHeatmapOverlay,
  drawHeatCluster,
  drawSoftBridge,
} from "./heatmapRenderer.js";
import { clamp } from "./helpers.js";

function getErrorDetail(error: unknown): unknown {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return error;
}

function pruneHeat(heatState: HeatState): void {
  const minTs = Date.now() - HEATMAP_WINDOW_MIN * 60 * 1000;
  heatState.points = heatState.points.filter((point) => point.ts >= minTs);
}

export function addHeatPoint(x: number, y: number): void {
  const heatState = loadHeat();
  const ts = Date.now();

  heatState.points.push({
    x: clamp(x, 0, MAP_SIZE),
    y: clamp(y, 0, MAP_SIZE),
    ts,
  });

  pruneHeat(heatState);
  saveHeat(heatState);
}

function renderHeatPng(points: HeatPoint[], outPath: string, baseMapPath = ""): void {
  let basePng = null;
  let width = HEATMAP_WIDTH;
  let height = HEATMAP_HEIGHT;

  try {
    if (baseMapPath && fs.existsSync(baseMapPath)) {
      const buffer = fs.readFileSync(baseMapPath);
      basePng = PNG.sync.read(buffer);
      width = basePng.width;
      height = basePng.height;
    }
  } catch (error) {
    console.warn(
      "[heatmap] no se pudo leer MAP_IMAGE_PATH, uso lienzo transparente:",
      getErrorDetail(error)
    );
  }

  const clusters = buildHeatClusters(points);
  const overlay = new PNG({ width, height });
  overlay.data.fill(0);

  const fivePlusClusters = clusters.filter((cluster) => cluster.count >= 5);
  const bridgeConnections = [];

  for (let i = 0; i < fivePlusClusters.length; i++) {
    for (let j = i + 1; j < fivePlusClusters.length; j++) {
      const firstCluster = fivePlusClusters[i];
      const secondCluster = fivePlusClusters[j];

      const deltaX = secondCluster.x - firstCluster.x;
      const deltaY = secondCluster.y - firstCluster.y;
      const worldDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      if (worldDistance >= 125 && worldDistance <= 300) {
        bridgeConnections.push({
          firstCluster,
          secondCluster,
        });
      }
    }
  }

  for (const { firstCluster, secondCluster } of bridgeConnections) {
    const firstPixel = mapToPixelCoords(firstCluster.x, firstCluster.y, width, height);
    const secondPixel = mapToPixelCoords(secondCluster.x, secondCluster.y, width, height);

    drawSoftBridge(
      overlay,
      firstPixel.px,
      firstPixel.py,
      secondPixel.px,
      secondPixel.py,
      28,
      59,
      130,
      246,
      95,
      width,
      height
    );
    drawSoftBridge(
      overlay,
      firstPixel.px,
      firstPixel.py,
      secondPixel.px,
      secondPixel.py,
      18,
      34,
      197,
      94,
      90,
      width,
      height
    );
    drawSoftBridge(
      overlay,
      firstPixel.px,
      firstPixel.py,
      secondPixel.px,
      secondPixel.py,
      9,
      234,
      179,
      8,
      70,
      width,
      height
    );
  }

  for (const cluster of clusters) {
    const { px, py } = mapToPixelCoords(cluster.x, cluster.y, width, height);
    const visualCount = Math.min(cluster.count, 5);

    drawHeatCluster(overlay, px, py, visualCount, width, height);
  }

  const output = composeHeatmapOverlay(basePng, overlay, width, height);

  fs.writeFileSync(outPath, PNG.sync.write(output));
}

let heatmapSending = false;

export async function maybeSendHeatmap(client: Client): Promise<void> {
  if (!HEATMAP_CHANNEL_ID) return;

  const now = Date.now();
  const heatState = loadHeat();
  const previousPointCount = heatState.points.length;

  pruneHeat(heatState);

  if (heatState.points.length !== previousPointCount) {
    saveHeat(heatState);
  }

  if (heatmapSending) return;
  heatmapSending = true;

  try {
    const channel = await client.channels.fetch(HEATMAP_CHANNEL_ID).catch(() => null);

    if (
      !channel?.isTextBased() ||
      !("send" in channel) ||
      typeof channel.send !== "function" ||
      !("messages" in channel)
    ) {
      console.warn("[heatmap] Invalid channel or missing permissions");
      return;
    }

    const updatedTimestamp = Math.floor(now / 1000);
    const embed = new EmbedBuilder()
      .setTitle("🗺️ • PvP Heatmap")
      .setColor(0x00ae86)
      .setFooter({ text: `Bellok's Killfeed • ${MAP_DISPLAY_NAME}` })
      .setTimestamp(now);

    let payload: ReturnType<typeof buildHeatmapMessagePayload>;

    if (heatState.points.length) {
      renderHeatPng(heatState.points, HEAT_IMG_PATH, MAP_IMAGE_PATH);
      await new Promise((resolve) => setTimeout(resolve, 80));

      const file = new AttachmentBuilder(HEAT_IMG_PATH);

      embed
        .setDescription(
          `• **Updated:** <t:${updatedTimestamp}:R>\n` + `• **Entries:** ${heatState.points.length}`
        )
        .setImage(`attachment://${HEAT_IMG_PATH.split("/").pop()}`);

      payload = buildHeatmapMessagePayload({ embed, file });
    } else {
      embed.setDescription(`No PvP activity in the last ${HEATMAP_WINDOW_MIN} minutes.`);
      payload = buildHeatmapMessagePayload({ embed });
    }

    let sent = false;

    if (heatState.messageId) {
      try {
        const existingMessage = await channel.messages.fetch(heatState.messageId).catch(() => null);

        if (existingMessage) {
          await existingMessage.edit(payload);
          sent = true;
          console.log("[heatmap] edited existing message", heatState.messageId);
        } else {
          console.log("[heatmap] previous message not found, sending new one");
          heatState.messageId = null;
        }
      } catch (error) {
        console.warn("[heatmap] failed to edit message, sending new one:", getErrorDetail(error));
        heatState.messageId = null;
      }
    }

    if (!sent) {
      const newMessage = await channel.send(payload);
      heatState.messageId = newMessage.id;
      console.log("[heatmap] sent new message", heatState.messageId);
    }

    heatState.lastSentCount = heatState.points.length;
    heatState.lastUpdate = now;
    saveHeat(heatState);
  } catch (error) {
    console.warn("[heatmap] send error:", getErrorDetail(error));
  } finally {
    heatmapSending = false;
  }
}
