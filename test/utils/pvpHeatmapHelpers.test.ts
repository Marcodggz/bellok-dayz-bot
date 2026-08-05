import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { EmbedBuilder, type Client } from "discord.js";
import { PNG } from "pngjs";

interface HeatPoint {
  x: number;
  y: number;
  ts: number;
}

interface HeatState {
  points: HeatPoint[];
  lastSentCount: number;
  messageId: string | null;
  lastUpdate: number;
}

const mocks = vi.hoisted(() => ({
  loadHeat: vi.fn(),
  saveHeat: vi.fn(),
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  buildHeatmapMessagePayload: vi.fn(),
}));

vi.mock("../../src/storage/heatStore.js", () => ({
  loadHeat: mocks.loadHeat,
  saveHeat: mocks.saveHeat,
}));

vi.mock("node:fs", () => ({
  default: {
    existsSync: mocks.existsSync,
    readFileSync: mocks.readFileSync,
    writeFileSync: mocks.writeFileSync,
  },
}));

vi.mock("../../src/utils/heatmapMessagePayload.js", () => ({
  buildHeatmapMessagePayload: mocks.buildHeatmapMessagePayload,
}));

vi.mock("../../src/config/config.js", () => ({
  HEATMAP_CHANNEL_ID: "pvp-channel",
  HEATMAP_HEIGHT: 64,
  HEATMAP_WIDTH: 64,
  HEATMAP_WINDOW_MIN: 15,
  HEAT_IMG_PATH: "./heatmap.png",
  MAP_DISPLAY_NAME: "Livonia",
  MAP_IMAGE_PATH: "./images/livonia.png",
  MAP_SIZE: 12800,
  MAP_MIN_X: 0,
  MAP_MAX_X: 12800,
  MAP_MIN_Y: 0,
  MAP_MAX_Y: 12800,
  MAP_FLIP_Y: true,
  MAP_OFFSET_X: 0,
  MAP_OFFSET_Y: 0,
  MAP_SCALE_X: 1,
  MAP_SCALE_Y: 1,
  MAP_PIX_INSET_L: 0,
  MAP_PIX_INSET_R: 0,
  MAP_PIX_INSET_T: 0,
  MAP_PIX_INSET_B: 0,
}));

import { resetBaseMapPngCache } from "../../src/utils/baseMapCache.ts";
import { addHeatPoint, maybeSendHeatmap } from "../../src/utils/pvpHeatmapHelpers.ts";

interface MockDiscord {
  client: Client;
  channelFetch: ReturnType<typeof vi.fn>;
  messageFetch: ReturnType<typeof vi.fn>;
  edit: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
}

function createState(overrides: Partial<HeatState> = {}): HeatState {
  return {
    points: [],
    lastSentCount: 0,
    messageId: null,
    lastUpdate: 0,
    ...overrides,
  };
}

function createDiscordMock(options?: {
  existingMessage?: boolean;
  sentMessageId?: string;
}): MockDiscord {
  const edit = vi.fn(async () => undefined);

  const existingMessage =
    options?.existingMessage === false
      ? null
      : {
          edit,
        };

  const messageFetch = vi.fn(async () => existingMessage);
  const send = vi.fn(async () => ({
    id: options?.sentMessageId ?? "new-message",
  }));

  const channel = {
    isTextBased: () => true,
    messages: {
      fetch: messageFetch,
    },
    send,
  };

  const channelFetch = vi.fn(async () => channel);

  const client = {
    channels: {
      fetch: channelFetch,
    },
  } as unknown as Client;

  return {
    client,
    channelFetch,
    messageFetch,
    edit,
    send,
  };
}

describe("pvpHeatmapHelpers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-18T12:00:00Z"));
    vi.clearAllMocks();
    resetBaseMapPngCache();

    mocks.existsSync.mockReturnValue(false);
    mocks.buildHeatmapMessagePayload.mockImplementation(({ embed, file }) =>
      file
        ? {
            content: "",
            embeds: [embed],
            files: [file],
          }
        : {
            content: "",
            embeds: [embed],
            attachments: [],
          }
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("adds a clamped point, removes expired points, and saves the state", () => {
    const now = Date.now();
    const state = createState({
      points: [
        {
          x: 1000,
          y: 2000,
          ts: now - 16 * 60 * 1000,
        },
      ],
    });

    mocks.loadHeat.mockReturnValue(state);

    addHeatPoint(-50, 13000);

    expect(state.points).toEqual([
      {
        x: 0,
        y: 12800,
        ts: now,
      },
    ]);
    expect(mocks.saveHeat).toHaveBeenCalledWith(state);
  });

  test("prunes expired points and edits the existing message without an attachment", async () => {
    const now = Date.now();
    const state = createState({
      messageId: "existing-message",
      points: [
        {
          x: 1000,
          y: 2000,
          ts: now - 16 * 60 * 1000,
        },
      ],
    });

    mocks.loadHeat.mockReturnValue(state);

    const discord = createDiscordMock();

    await maybeSendHeatmap(discord.client);

    expect(discord.messageFetch).toHaveBeenCalledWith("existing-message");
    expect(discord.edit).toHaveBeenCalledTimes(1);
    expect(discord.send).not.toHaveBeenCalled();

    const payload = discord.edit.mock.calls[0]?.[0];
    const embed = payload?.embeds?.[0];

    expect(embed).toBeInstanceOf(EmbedBuilder);

    if (!(embed instanceof EmbedBuilder)) {
      throw new Error("PvP heatmap edit did not contain an EmbedBuilder");
    }

    expect(embed.toJSON().description).toBe("No PvP activity in the last 15 minutes.");
    expect(payload).toEqual(
      expect.objectContaining({
        attachments: [],
      })
    );
    expect(payload).not.toHaveProperty("files");

    expect(state.points).toEqual([]);
    expect(state.lastSentCount).toBe(0);
    expect(state.lastUpdate).toBe(now);
    expect(mocks.saveHeat).toHaveBeenCalled();
  });

  test("sends a new message when the previous message no longer exists", async () => {
    const now = Date.now();
    const state = createState({
      messageId: "missing-message",
    });

    mocks.loadHeat.mockReturnValue(state);

    const discord = createDiscordMock({
      existingMessage: false,
      sentMessageId: "replacement-message",
    });

    await maybeSendHeatmap(discord.client);

    expect(discord.messageFetch).toHaveBeenCalledWith("missing-message");
    expect(discord.edit).not.toHaveBeenCalled();
    expect(discord.send).toHaveBeenCalledTimes(1);

    expect(state.messageId).toBe("replacement-message");
    expect(state.lastSentCount).toBe(0);
    expect(state.lastUpdate).toBe(now);
    expect(mocks.saveHeat).toHaveBeenLastCalledWith(state);
  });

  test("reads the base map only once across two consecutive renders", async () => {
    const now = Date.now();
    const state = createState({
      messageId: "existing-message",
      points: [
        {
          x: 1000,
          y: 2000,
          ts: now,
        },
      ],
    });

    const baseMap = new PNG({ width: 64, height: 64 });
    baseMap.data.fill(0);

    mocks.loadHeat.mockReturnValue(state);
    mocks.existsSync.mockReturnValue(true);
    mocks.readFileSync.mockReturnValue(PNG.sync.write(baseMap));

    const discord = createDiscordMock();

    const firstRender = maybeSendHeatmap(discord.client);
    await vi.runAllTimersAsync();
    await firstRender;

    const secondRender = maybeSendHeatmap(discord.client);
    await vi.runAllTimersAsync();
    await secondRender;

    expect(mocks.readFileSync).toHaveBeenCalledTimes(1);
    expect(discord.edit).toHaveBeenCalledTimes(2);
  });

  test("edits an existing message with the rendered heatmap attachment", async () => {
    const now = Date.now();
    const state = createState({
      messageId: "existing-message",
      points: [
        {
          x: 1000,
          y: 2000,
          ts: now,
        },
      ],
    });

    mocks.loadHeat.mockReturnValue(state);

    const discord = createDiscordMock();

    const promise = maybeSendHeatmap(discord.client);
    await vi.runAllTimersAsync();
    await promise;

    expect(mocks.writeFileSync).toHaveBeenCalled();
    expect(discord.edit).toHaveBeenCalledTimes(1);

    const payload = discord.edit.mock.calls[0]?.[0];
    const embed = payload?.embeds?.[0];

    expect(embed).toBeInstanceOf(EmbedBuilder);

    if (!(embed instanceof EmbedBuilder)) {
      throw new Error("PvP heatmap edit did not contain an EmbedBuilder");
    }

    expect(embed.toJSON().description).toContain("**Entries:** 1");
    expect(embed.toJSON().image?.url).toBe("attachment://heatmap.png");
    expect(payload?.files).toHaveLength(1);
    expect(payload).not.toHaveProperty("attachments");

    expect(state.lastSentCount).toBe(1);
    expect(state.lastUpdate).toBe(now);
  });
});
