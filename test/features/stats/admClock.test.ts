import { beforeEach, describe, expect, test } from "vitest";

import {
  getEstimatedAdmTimeMs,
  resetAdmClock,
  updateAdmClock,
} from "../../../src/features/stats/admClock.ts";

describe("admClock", () => {
  beforeEach(() => {
    resetAdmClock();
  });

  test("returns the latest normalized ADM timestamp without extrapolation", () => {
    updateAdmClock(50_000);

    expect(getEstimatedAdmTimeMs()).toBe(50_000);
  });

  test("keeps the latest timestamp when an invalid timestamp arrives", () => {
    updateAdmClock(50_000);
    updateAdmClock(null);

    expect(getEstimatedAdmTimeMs()).toBe(50_000);
  });

  test("returns null before receiving an ADM timestamp", () => {
    expect(getEstimatedAdmTimeMs()).toBeNull();
  });
});
