import { describe, expect, test, vi } from "vitest";

import { createHeatmapCycle } from "../../src/utils/heatmapCycle.ts";

describe("createHeatmapCycle", () => {
  test("runs immediately and then respects the interval", async () => {
    let currentTime = 1000;
    const runCycle = vi.fn();

    const maybeRun = createHeatmapCycle({
      intervalMs: 60000,
      runCycle,
      now: () => currentTime,
    });

    expect(await maybeRun()).toBe(true);
    expect(await maybeRun()).toBe(false);

    currentTime += 59999;
    expect(await maybeRun()).toBe(false);

    currentTime += 1;
    expect(await maybeRun()).toBe(true);
    expect(runCycle).toHaveBeenCalledTimes(2);
  });

  test("prevents overlapping heatmap cycles", async () => {
    let releaseCycle;
    const pendingCycle = new Promise((resolve) => {
      releaseCycle = resolve;
    });

    const runCycle = vi.fn(() => pendingCycle);

    const maybeRun = createHeatmapCycle({
      intervalMs: 0,
      runCycle,
      now: () => 1000,
    });

    const firstRun = maybeRun();

    expect(await maybeRun()).toBe(false);
    expect(runCycle).toHaveBeenCalledTimes(1);

    releaseCycle();
    expect(await firstRun).toBe(true);
  });

  test("releases the lock when the cycle fails", async () => {
    const runCycle = vi
      .fn()
      .mockRejectedValueOnce(new Error("Discord failed"))
      .mockResolvedValueOnce();

    const maybeRun = createHeatmapCycle({
      intervalMs: 0,
      runCycle,
      now: () => 1000,
    });

    await expect(maybeRun()).rejects.toThrow("Discord failed");
    await expect(maybeRun()).resolves.toBe(true);

    expect(runCycle).toHaveBeenCalledTimes(2);
  });
});
