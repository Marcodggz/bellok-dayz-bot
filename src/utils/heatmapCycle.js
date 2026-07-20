function createHeatmapCycle({ intervalMs, runCycle, now = Date.now }) {
  let lastRunAt = Number.NEGATIVE_INFINITY;
  let running = false;

  return async function maybeRunHeatmapCycle() {
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

module.exports = {
  createHeatmapCycle,
};
