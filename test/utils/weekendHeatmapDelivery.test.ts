import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { EmbedBuilder, type Client } from "discord.js";

interface WeekendPoint {
  name: string;
  x: number;
  y: number;
  ts: number;
}

interface WeekendState {
  points: WeekendPoint[];
  messageId: string | null;
  lastUpdate: number;
}

const mocks = vi.hoisted(() => ({
  loadWeekendHeat: vi.fn(),
  saveWeekendHeat: vi.fn(),
  existsSync: vi.fn(),
  writeFileSync: vi.fn(),
  buildHeatmapMessagePayload: vi.fn(),
}));

vi.mock("../../src/storage/weekendHeatStore.js", () => ({
  loadWeekendHeat: mocks.loadWeekendHeat,
  saveWeekendHeat: mocks.saveWeekendHeat,
}));

vi.mock("node:fs", () => ({
  default: {
    existsSync: mocks.existsSync,
    readFileSync: vi.fn(),
    writeFileSync: mocks.writeFileSync,
  },
}));

vi.mock("../../src/utils/heatmapMessagePayload.js", () => ({
  buildHeatmapMessagePayload: mocks.buildHeatmapMessagePayload,
}));

vi.mock("../../src/config/config.js", () => ({
  WEEKEND_HEATMAP_WINDOW_MIN: 15,
  WEEKEND_HEATMAP_CHANNEL_ID: "weekend-channel",
  WEEKEND_HEATMAP_IMG_PATH: "./weekend-heatmap.png",
  MAP_IMAGE_PATH: "",
  MAP_DISPLAY_NAME: "Livonia",
  HEATMAP_WIDTH: 64,
  HEATMAP_HEIGHT: 64,
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
}));

import { maybeSendWeekendHeatmap } from "../../src/utils/weekendHeatmapHelpers.ts";

interface MockDiscord {
  client: Client;
  channelFetch: ReturnType<typeof vi.fn>;
  messageFetch: ReturnType<typeof vi.fn>;
  edit: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
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

function createState(overrides: Partial<WeekendState> = {}): WeekendState {
  return {
    points: [],
    messageId: null,
    lastUpdate: 0,
    ...overrides,
  };
}

describe("maybeSendWeekendHeatmap", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-18T12:00:00Z"));
    vi.clearAllMocks();

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

  test("does nothing outside Friday through Sunday", async () => {
    vi.setSystemTime(new Date("2026-07-20T12:00:00Z"));

    const state = createState();
    mocks.loadWeekendHeat.mockReturnValue(state);

    const discord = createDiscordMock();

    await maybeSendWeekendHeatmap(discord.client);

    expect(mocks.loadWeekendHeat).not.toHaveBeenCalled();
    expect(discord.channelFetch).not.toHaveBeenCalled();
    expect(mocks.saveWeekendHeat).not.toHaveBeenCalled();
  });

  test("prunes expired points and edits the existing message without an attachment", async () => {
    const now = Date.now();
    const state = createState({
      messageId: "existing-message",
      points: [
        {
          name: "ExpiredPlayer",
          x: 1000,
          y: 2000,
          ts: now - 16 * 60 * 1000,
        },
      ],
    });

    mocks.loadWeekendHeat.mockReturnValue(state);

    const discord = createDiscordMock();

    const promise = maybeSendWeekendHeatmap(discord.client);
    await vi.runAllTimersAsync();
    await promise;

    expect(discord.messageFetch).toHaveBeenCalledWith("existing-message");
    expect(discord.edit).toHaveBeenCalledTimes(1);
    expect(discord.send).not.toHaveBeenCalled();

    const payload = discord.edit.mock.calls[0]?.[0];
    const embed = payload?.embeds?.[0];

    expect(embed).toBeInstanceOf(EmbedBuilder);

    if (!(embed instanceof EmbedBuilder)) {
      throw new Error("Weekend heatmap edit did not contain an EmbedBuilder");
    }

    expect(embed.toJSON().description).toBe("No player locations recorded in the last 15 minutes.");
    expect(payload).toEqual(
      expect.objectContaining({
        attachments: [],
      })
    );
    expect(payload).not.toHaveProperty("files");

    expect(state.points).toEqual([]);
    expect(state.lastUpdate).toBe(now);
    expect(mocks.saveWeekendHeat).toHaveBeenCalled();
  });

  test("sends a new message when the previous message no longer exists", async () => {
    const now = Date.now();
    const state = createState({
      messageId: "missing-message",
      points: [],
    });

    mocks.loadWeekendHeat.mockReturnValue(state);

    const discord = createDiscordMock({
      existingMessage: false,
      sentMessageId: "replacement-message",
    });

    await maybeSendWeekendHeatmap(discord.client);

    expect(discord.messageFetch).toHaveBeenCalledWith("missing-message");
    expect(discord.edit).not.toHaveBeenCalled();
    expect(discord.send).toHaveBeenCalledTimes(1);

    expect(state.messageId).toBe("replacement-message");
    expect(state.lastUpdate).toBe(now);
    expect(mocks.saveWeekendHeat).toHaveBeenLastCalledWith(state);
  });

  test("edits an existing message with the rendered heatmap attachment", async () => {
    const now = Date.now();
    const state = createState({
      messageId: "existing-message",
      points: [
        {
          name: "ActivePlayer",
          x: 1000,
          y: 2000,
          ts: now,
        },
      ],
    });

    mocks.loadWeekendHeat.mockReturnValue(state);

    const discord = createDiscordMock();

    const promise = maybeSendWeekendHeatmap(discord.client);
    await vi.runAllTimersAsync();
    await promise;

    expect(mocks.writeFileSync).toHaveBeenCalled();
    expect(discord.edit).toHaveBeenCalledTimes(1);

    const payload = discord.edit.mock.calls[0]?.[0];
    const embed = payload?.embeds?.[0];

    expect(embed).toBeInstanceOf(EmbedBuilder);

    if (!(embed instanceof EmbedBuilder)) {
      throw new Error("Weekend heatmap edit did not contain an EmbedBuilder");
    }

    expect(embed.toJSON().description).toContain("**Players:** 1");
    expect(embed.toJSON().image?.url).toBe("attachment://weekend-heatmap.png");
    expect(payload?.files).toHaveLength(1);
    expect(payload).not.toHaveProperty("attachments");

    expect(state.messageId).toBe("existing-message");
    expect(state.lastUpdate).toBe(now);
  });
});
