import { describe, expect, test } from "vitest";
import { PNG } from "pngjs";

import {
  buildHeatClusters,
  composeHeatmapOverlay,
  drawHeatCluster,
  drawSoftBridge,
} from "../../src/utils/heatmapRenderer.ts";

function getPixel(png: PNG, x: number, y: number): [number, number, number, number] {
  const offset = (y * png.width + x) * 4;

  return [png.data[offset + 0], png.data[offset + 1], png.data[offset + 2], png.data[offset + 3]];
}

describe("heatmapRenderer", () => {
  describe("buildHeatClusters", () => {
    test("returns no clusters for an empty point list", () => {
      expect(buildHeatClusters([])).toEqual([]);
    });

    test("merges points within 125 metres and averages their position", () => {
      const clusters = buildHeatClusters([
        { x: 1000, y: 1000 },
        { x: 1100, y: 1000 },
      ]);

      expect(clusters).toEqual([
        {
          x: 1050,
          y: 1000,
          count: 2,
        },
      ]);
    });

    test("keeps points beyond 125 metres in separate clusters", () => {
      const clusters = buildHeatClusters([
        { x: 1000, y: 1000 },
        { x: 1126, y: 1000 },
      ]);

      expect(clusters).toEqual([
        {
          x: 1000,
          y: 1000,
          count: 1,
        },
        {
          x: 1126,
          y: 1000,
          count: 1,
        },
      ]);
    });

    test("updates the running average when several points merge", () => {
      const clusters = buildHeatClusters([
        { x: 1000, y: 1000 },
        { x: 1060, y: 1000 },
        { x: 1120, y: 1000 },
      ]);

      expect(clusters).toEqual([
        {
          x: 1060,
          y: 1000,
          count: 3,
        },
      ]);
    });
  });

  describe("drawHeatCluster", () => {
    test("draws an opaque centre and transparent pixels outside its radius", () => {
      const overlay = new PNG({ width: 80, height: 80 });
      overlay.data.fill(0);

      drawHeatCluster(overlay, 40, 40, 1, 80, 80);

      expect(getPixel(overlay, 40, 40)[3]).toBeGreaterThan(0);
      expect(getPixel(overlay, 0, 0)).toEqual([0, 0, 0, 0]);
    });

    test("clips drawing safely at canvas boundaries", () => {
      const overlay = new PNG({ width: 20, height: 20 });
      overlay.data.fill(0);

      expect(() => {
        drawHeatCluster(overlay, 0, 0, 5, 20, 20);
      }).not.toThrow();

      expect(getPixel(overlay, 0, 0)[3]).toBeGreaterThan(0);
      expect(overlay.data).toHaveLength(20 * 20 * 4);
    });

    test("does not replace a pixel with a weaker alpha value", () => {
      const overlay = new PNG({ width: 80, height: 80 });
      overlay.data.fill(0);

      drawHeatCluster(overlay, 40, 40, 5, 80, 80);
      const original = getPixel(overlay, 40, 40);

      drawHeatCluster(overlay, 40, 40, 1, 80, 80);

      expect(getPixel(overlay, 40, 40)).toEqual(original);
    });
  });

  describe("composeHeatmapOverlay", () => {
    test("returns the original overlay when no base map exists", () => {
      const overlay = new PNG({ width: 2, height: 2 });

      expect(composeHeatmapOverlay(null, overlay, 2, 2)).toBe(overlay);
    });

    test("alpha-blends the overlay onto the base map", () => {
      const base = new PNG({ width: 1, height: 1 });
      const overlay = new PNG({ width: 1, height: 1 });

      base.data.set([100, 100, 100, 255]);
      overlay.data.set([200, 0, 0, 128]);

      const output = composeHeatmapOverlay(base, overlay, 1, 1);
      const [red, green, blue, alpha] = getPixel(output, 0, 0);

      expect(red).toBeGreaterThan(100);
      expect(green).toBeLessThan(100);
      expect(blue).toBeLessThan(100);
      expect(alpha).toBe(255);
    });

    test("preserves the base pixel when the overlay is transparent", () => {
      const base = new PNG({ width: 1, height: 1 });
      const overlay = new PNG({ width: 1, height: 1 });

      base.data.set([25, 50, 75, 255]);
      overlay.data.set([200, 100, 50, 0]);

      const output = composeHeatmapOverlay(base, overlay, 1, 1);

      expect(getPixel(output, 0, 0)).toEqual([25, 50, 75, 255]);
    });
  });

  describe("drawSoftBridge", () => {
    test("draws a coloured bridge between two points", () => {
      const overlay = new PNG({ width: 40, height: 20 });
      overlay.data.fill(0);

      drawSoftBridge(overlay, 5, 10, 35, 10, 4, 255, 100, 50, 200, 40, 20);

      expect(getPixel(overlay, 20, 10)).toEqual([255, 100, 50, 200]);
      expect(getPixel(overlay, 20, 0)).toEqual([0, 0, 0, 0]);
    });

    test("supports a zero-length bridge as a radial point", () => {
      const overlay = new PNG({ width: 20, height: 20 });
      overlay.data.fill(0);

      drawSoftBridge(overlay, 10, 10, 10, 10, 3, 10, 20, 30, 180, 20, 20);

      expect(getPixel(overlay, 10, 10)).toEqual([10, 20, 30, 180]);
      expect(getPixel(overlay, 0, 0)).toEqual([0, 0, 0, 0]);
    });

    test("does not overwrite a stronger existing alpha", () => {
      const overlay = new PNG({ width: 20, height: 20 });
      overlay.data.fill(0);

      drawSoftBridge(overlay, 2, 10, 18, 10, 3, 255, 0, 0, 220, 20, 20);

      const original = getPixel(overlay, 10, 10);

      drawSoftBridge(overlay, 2, 10, 18, 10, 3, 0, 255, 0, 100, 20, 20);

      expect(getPixel(overlay, 10, 10)).toEqual(original);
    });
  });
});
