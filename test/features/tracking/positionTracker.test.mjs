import { createRequire } from "node:module";
import { beforeEach, describe, expect, test, vi } from "vitest";

const require = createRequire(import.meta.url);

const trackerPath =
  require.resolve("../../../src/features/tracking/positionTracker.js");
const weekendHelpersPath =
  require.resolve("../../../src/utils/weekendHeatmapHelpers.js");

let updatePositionsFromLine;
let posForVictimFromLine;
let addWeekendHeatPoint;

beforeEach(() => {
  delete require.cache[trackerPath];
  delete require.cache[weekendHelpersPath];

  addWeekendHeatPoint = vi.fn();

  require.cache[weekendHelpersPath] = {
    id: weekendHelpersPath,
    filename: weekendHelpersPath,
    loaded: true,
    exports: { addWeekendHeatPoint },
  };

  ({ updatePositionsFromLine, posForVictimFromLine } = require(trackerPath));
});

describe("positionTracker", () => {
  describe("updatePositionsFromLine", () => {
    test("stores a valid player position from an ADM line using X and Y coordinates", () => {
      // ADM format: pos=<X, Y, Z> where X and Y are horizontal, Z is elevation
      const line = 'Player "Alice" (id=123 pos=<1234.5, 5678.9, 10.0>)';

      updatePositionsFromLine(line);

      const pos = posForVictimFromLine("Alice", "");
      // Should use X (1234.5) and Y (5678.9) for horizontal coordinates
      expect(pos).toEqual({ x: 1234.5, y: 5678.9 });
    });

    test("ignores lines without valid coordinates", () => {
      const line = 'Player "Bob" connected to the server';

      updatePositionsFromLine(line);

      const pos = posForVictimFromLine("Bob", "");
      expect(pos).toBeNull();
    });

    test("a later valid position replaces the previous one for the same player", () => {
      // ADM format: pos=<X, Y, Z> - using X and Y for horizontal coordinates
      updatePositionsFromLine(
        'Player "Charlie" (id=1 pos=<100.0, 200.0, 5.0>)',
      );
      updatePositionsFromLine(
        'Player "Charlie" (id=1 pos=<300.0, 400.0, 7.0>)',
      );

      const pos = posForVictimFromLine("Charlie", "");
      // Should use X (300.0) and Y (400.0)
      expect(pos).toEqual({ x: 300.0, y: 400.0 });
    });
  });

  describe("posForVictimFromLine", () => {
    test("prefers coordinates found directly in the provided line using X and Y", () => {
      updatePositionsFromLine('Player "Dave" (id=1 pos=<111.0, 222.0, 5.0>)');

      const line = 'Player "Dave" (id=1 pos=<999.0, 888.0, 777.0>) killed';
      const pos = posForVictimFromLine("Dave", line);

      // Should extract X (999.0) and Y (888.0)
      expect(pos).toEqual({ x: 999.0, y: 888.0 });
    });

    test("falls back to the last tracked position when the line has no coordinates", () => {
      updatePositionsFromLine('Player "Eve" (id=1 pos=<555.0, 666.0, 444.0>)');

      const line = 'Player "Eve" was killed';
      const pos = posForVictimFromLine("Eve", line);

      // Should use X (555.0) and Y (666.0) from stored position
      expect(pos).toEqual({ x: 555.0, y: 666.0 });
    });

    test("returns null when neither source has a valid position", () => {
      const line = 'Player "Frank" was killed';
      const pos = posForVictimFromLine("Frank", line);

      expect(pos).toBeNull();
    });

    test("preserves support for straight and curly quotes in player names", () => {
      // Straight quotes - ADM format pos=<X, Y, Z>, we use X and Y
      updatePositionsFromLine('Player "George" (id=1 pos=<100.0, 200.0, 5.0>)');
      expect(posForVictimFromLine("George", "")).toEqual({
        x: 100.0,
        y: 200.0, // Y coordinate (horizontal)
      });

      // Curly opening quote
      updatePositionsFromLine("Player “Hannah” (id=2 pos=<300.0, 400.0, 7.0>)");
      expect(posForVictimFromLine("Hannah", "")).toEqual({
        x: 300.0,
        y: 400.0, // Y coordinate (horizontal)
      });

      // Curly closing quote
      updatePositionsFromLine('Player "Ian” (id=3 pos=<500.0, 600.0, 9.0>)');
      expect(posForVictimFromLine("Ian", "")).toEqual({ x: 500.0, y: 600.0 });
    });
  });

  describe("weekend position storage", () => {
    test("is called only when a valid position is captured", () => {
      const validLine = 'Player "Jack" (id=1 pos=<700.0, 800.0, 5.0>)';
      const invalidLine = 'Player "Jill" connected';

      updatePositionsFromLine(validLine);
      updatePositionsFromLine(invalidLine);

      // Should be called with X and Y coordinates (horizontal plane)
      expect(addWeekendHeatPoint).toHaveBeenCalledTimes(1);
      expect(addWeekendHeatPoint).toHaveBeenCalledWith("Jack", 700.0, 800.0);
    });

    test("regression test: correctly extracts coordinates from real ADM sample", () => {
      // Real sample from user's ADM log: pos=<13044.9, 7786.9, 5.6>
      // X=13044.9 (horizontal), Y=7786.9 (horizontal), Z=5.6 (elevation)
      const line =
        'Player "RealPlayer" (id=12345678 pos=<13044.9, 7786.9, 5.6>)';

      updatePositionsFromLine(line);

      const pos = posForVictimFromLine("RealPlayer", "");
      expect(pos).toEqual({ x: 13044.9, y: 7786.9 });

      // Verify weekend heatmap gets correct horizontal coordinates
      expect(addWeekendHeatPoint).toHaveBeenCalledWith(
        "RealPlayer",
        13044.9,
        7786.9,
      );
    });
  });
});
