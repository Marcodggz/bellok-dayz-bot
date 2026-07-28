let latestNormalizedTimeMs: number | null = null;

export function updateAdmClock(normalizedTimeMs: number | null): void {
  if (normalizedTimeMs !== null) {
    latestNormalizedTimeMs = normalizedTimeMs;
  }
}

export function getEstimatedAdmTimeMs(): number | null {
  return latestNormalizedTimeMs;
}

export function resetAdmClock(): void {
  latestNormalizedTimeMs = null;
}
