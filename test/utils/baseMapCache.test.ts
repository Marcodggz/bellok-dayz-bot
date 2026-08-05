import { beforeEach, describe, expect, test, vi } from "vitest";
import { PNG } from "pngjs";

const mocks = vi.hoisted(() => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

vi.mock("node:fs", () => ({
  default: {
    existsSync: mocks.existsSync,
    readFileSync: mocks.readFileSync,
  },
}));

import { loadBaseMapPng, resetBaseMapPngCache } from "../../src/utils/baseMapCache.ts";

function createPngBuffer(width: number, height: number): Buffer {
  const png = new PNG({ width, height });
  png.data.fill(0);

  return PNG.sync.write(png);
}

describe("baseMapCache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetBaseMapPngCache();

    mocks.existsSync.mockReturnValue(true);
    mocks.readFileSync.mockReturnValue(createPngBuffer(2, 3));
  });

  test("reads and decodes the same base map only once", () => {
    const first = loadBaseMapPng("./images/livonia.png");
    const second = loadBaseMapPng("./images/livonia.png");

    expect(first).toBe(second);
    expect(first).toMatchObject({
      width: 2,
      height: 3,
    });
    expect(mocks.existsSync).toHaveBeenCalledTimes(1);
    expect(mocks.readFileSync).toHaveBeenCalledTimes(1);
  });

  test("invalidates the cache when the base-map path changes", () => {
    mocks.readFileSync
      .mockReturnValueOnce(createPngBuffer(2, 3))
      .mockReturnValueOnce(createPngBuffer(4, 5));

    const first = loadBaseMapPng("./images/livonia.png");
    const second = loadBaseMapPng("./images/chernarus.png");

    expect(first).not.toBe(second);
    expect(second).toMatchObject({
      width: 4,
      height: 5,
    });
    expect(mocks.readFileSync).toHaveBeenCalledTimes(2);
  });

  test("returns null without reading when the path is empty or missing", () => {
    expect(loadBaseMapPng("")).toBeNull();

    mocks.existsSync.mockReturnValue(false);

    expect(loadBaseMapPng("./images/missing.png")).toBeNull();
    expect(mocks.readFileSync).not.toHaveBeenCalled();
  });

  test("does not cache a failed read", () => {
    mocks.readFileSync
      .mockImplementationOnce(() => {
        throw new Error("read failed");
      })
      .mockReturnValueOnce(createPngBuffer(2, 3));

    expect(() => loadBaseMapPng("./images/livonia.png")).toThrow("read failed");
    expect(loadBaseMapPng("./images/livonia.png")).toMatchObject({
      width: 2,
      height: 3,
    });
    expect(mocks.readFileSync).toHaveBeenCalledTimes(2);
  });

  test("can reset the cache explicitly", () => {
    loadBaseMapPng("./images/livonia.png");
    resetBaseMapPngCache();
    loadBaseMapPng("./images/livonia.png");

    expect(mocks.readFileSync).toHaveBeenCalledTimes(2);
  });
});
