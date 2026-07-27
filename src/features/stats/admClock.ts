let latestNormalizedTimeMs: number | null = null;
let latestObservedAtMs: number | null = null;

export function updateAdmClock(
  normalizedTimeMs: number | null,
  observedAtMs: number = Date.now()
): void {
  if (normalizedTimeMs === null) {
    return;
  }

  latestNormalizedTimeMs = normalizedTimeMs;
  latestObservedAtMs = observedAtMs;
}

export function getEstimatedAdmTimeMs(nowMs: number = Date.now()): number | null {
  if (latestNormalizedTimeMs === null || latestObservedAtMs === null) {
    return null;
  }

  return latestNormalizedTimeMs + Math.max(0, nowMs - latestObservedAtMs);
}

export function resetAdmClock(): void {
  latestNormalizedTimeMs = null;
  latestObservedAtMs = null;
}
