interface HeatmapCycleOptions {
  intervalMs: number;
  runCycle: () => void | Promise<void>;
  now?: () => number;
}

export type HeatmapCycleRunner = () => Promise<boolean>;

export function createHeatmapCycle({
  intervalMs,
  runCycle,
  now = Date.now,
}: HeatmapCycleOptions): HeatmapCycleRunner {
  let lastRunAt = Number.NEGATIVE_INFINITY;
  let running = false;

  return async function maybeRunHeatmapCycle(): Promise<boolean> {
    const currentTime = now();

    if (running || currentTime - lastRunAt < intervalMs) {
      return false;
    }

    running = true;
    lastRunAt = currentTime;

    try {
      await runCycle();
      return true;
    } finally {
      running = false;
    }
  };
}
