import { beforeEach, describe, expect, test, vi } from "vitest";

let queueKillfeedEvent;
let flushKillfeedQueue;
let buildKillEmbed;
let markSentBucket;

beforeEach(async () => {
  vi.useFakeTimers();
  vi.resetModules();
  vi.clearAllMocks();

  buildKillEmbed = vi.fn(() => ({
    embeds: [{ description: "kill embed" }],
  }));

  markSentBucket = vi.fn();

  vi.doMock("../../../src/features/killfeed/embedBuilders.ts", () => ({
    buildKillEmbed,
  }));

  vi.doMock("../../../src/features/killfeed/killEventDeduplicator.ts", () => ({
    markSentBucket,
  }));

  ({ queueKillfeedEvent, flushKillfeedQueue } =
    await import("../../../src/features/killfeed/killfeedQueue.ts"));
});

describe("killfeedQueue", () => {
  test("marks a bucket only after Discord accepts the kill embed", async () => {
    const send = vi.fn().mockResolvedValue({});
    const client = {
      channels: {
        fetch: vi.fn().mockResolvedValue({ send }),
      },
    };

    queueKillfeedEvent(
      {
        kill: {
          type: "pvp",
          killer: "Killer",
          victim: "Victim",
          weapon: "M4A1",
          t: "12:00:00",
        },
        line: '12:00:00 | Player "Killer" killed Player "Victim"',
      },
      "Victim|2160"
    );

    const flushPromise = flushKillfeedQueue(client, "channel-id", false, false);

    await vi.runAllTimersAsync();
    await flushPromise;

    expect(send).toHaveBeenCalledTimes(1);
    expect(markSentBucket).toHaveBeenCalledTimes(1);
    expect(markSentBucket).toHaveBeenCalledWith("Victim|2160");
  });

  test("does not mark or remove a bucket when Discord rejects the embed", async () => {
    const send = vi.fn().mockRejectedValue(new Error("Discord unavailable"));
    const client = {
      channels: {
        fetch: vi.fn().mockResolvedValue({ send }),
      },
    };

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    queueKillfeedEvent(
      {
        kill: {
          type: "explosion",
          victim: "Victim",
          device: "Landmine",
          t: "12:00:00",
        },
        line: '12:00:00 | Player "Victim" killed by Landmine explosion',
      },
      "Victim|2160"
    );

    await flushKillfeedQueue(client, "channel-id", false, false);

    expect(markSentBucket).not.toHaveBeenCalled();

    send.mockResolvedValue({});

    const retryPromise = flushKillfeedQueue(client, "channel-id", false, false);

    await vi.runAllTimersAsync();
    await retryPromise;

    expect(send).toHaveBeenCalledTimes(2);
    expect(markSentBucket).toHaveBeenCalledTimes(1);
    expect(markSentBucket).toHaveBeenCalledWith("Victim|2160");

    consoleErrorSpy.mockRestore();
  });

  test("does not resend the kill embed when optional raw-line delivery fails", async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error("Raw line failed"));

    const client = {
      channels: {
        fetch: vi.fn().mockResolvedValue({ send }),
      },
    };

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    queueKillfeedEvent(
      {
        kill: {
          type: "pvp",
          killer: "Killer",
          victim: "Victim",
          weapon: "M4A1",
          t: "12:00:00",
        },
        line: '12:00:00 | Player "Killer" killed Player "Victim"',
      },
      "Victim|2160"
    );

    const flushPromise = flushKillfeedQueue(client, "channel-id", false, true);

    await vi.runAllTimersAsync();
    await flushPromise;

    expect(send).toHaveBeenCalledTimes(2);
    expect(markSentBucket).toHaveBeenCalledTimes(1);

    await flushKillfeedQueue(client, "channel-id", false, true);

    expect(send).toHaveBeenCalledTimes(2);

    consoleErrorSpy.mockRestore();
  });

  test("continues after a persistence error without resending the Discord embed", async () => {
    const send = vi.fn().mockResolvedValue({});
    const client = {
      channels: {
        fetch: vi.fn().mockResolvedValue({ send }),
      },
    };

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    markSentBucket.mockImplementation(() => {
      throw new Error("state write failed");
    });

    queueKillfeedEvent(
      {
        kill: {
          type: "pvp",
          killer: "Killer",
          victim: "Victim",
          weapon: "M4A1",
          t: "12:00:00",
        },
      },
      "Victim|2160"
    );

    const flushPromise = flushKillfeedQueue(client, "channel-id", false, false);

    await vi.runAllTimersAsync();
    await flushPromise;

    expect(send).toHaveBeenCalledTimes(1);
    expect(markSentBucket).toHaveBeenCalledTimes(1);

    await flushKillfeedQueue(client, "channel-id", false, false);

    expect(send).toHaveBeenCalledTimes(1);

    consoleErrorSpy.mockRestore();
  });
});
