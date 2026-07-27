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

  test("estimates current ADM time from elapsed real time", () => {
    updateAdmClock(50_000, 1_000);

    expect(getEstimatedAdmTimeMs(6_000)).toBe(55_000);
  });

  test("returns null before receiving an ADM timestamp", () => {
    expect(getEstimatedAdmTimeMs(10_000)).toBeNull();
  });
});
