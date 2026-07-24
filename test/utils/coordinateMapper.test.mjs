import { beforeEach, describe, expect, test, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();

  process.env.MAP_SIZE = "12800";
  process.env.MAP_MIN_X = "0";
  process.env.MAP_MAX_X = "12800";
  process.env.MAP_MIN_Y = "0";
  process.env.MAP_MAX_Y = "12800";
  process.env.MAP_FLIP_Y = "1";
  process.env.MAP_OFFSET_X = "0";
  process.env.MAP_OFFSET_Y = "0";
  process.env.MAP_SCALE_X = "1";
  process.env.MAP_SCALE_Y = "1";
  process.env.MAP_PIX_INSET_L = "8";
  process.env.MAP_PIX_INSET_R = "8";
  process.env.MAP_PIX_INSET_T = "8";
  process.env.MAP_PIX_INSET_B = "34";
});

describe("coordinateMapper", () => {
  test("maps the verified Livonia kill coordinates to the expected pixel", async () => {
    const { mapToPixelCoords } = await import("../../src/utils/coordinateMapper.ts");

    const result = mapToPixelCoords(10703.8, 10937.7, 2048, 2048);

    expect(result).toEqual({
      px: 1707,
      py: 299,
    });
  });
});
