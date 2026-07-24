// Player position tracking from ADM log lines
// ADM pos=<X, Y, Z>: X/Y are map coordinates; Z is elevation.

import type { Position2D } from "../../types/domainEvents";
import { escapeRegExp } from "../../utils/helpers.js";
import { addWeekendHeatPoint } from "../../utils/weekendHeatmapHelpers.js";

interface TrackedPosition extends Position2D {
  ts: number;
}

const lastPosByName = new Map<string, TrackedPosition>();

export function updatePositionsFromLine(line: string): void {
  const positionPattern =
    /Player\s+["'“”]([^"'“”]+)["'“”]\s*\([^)]*?pos=<\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.-]+)\s*>\)/gi;

  let match: RegExpExecArray | null;

  while ((match = positionPattern.exec(line)) !== null) {
    const playerName = match[1];
    const x = Number(match[2]);
    const y = Number(match[3]);

    if (!Number.isNaN(x) && !Number.isNaN(y)) {
      lastPosByName.set(playerName, {
        x,
        y,
        ts: Date.now(),
      });

      addWeekendHeatPoint(playerName, x, y);
    }
  }
}

export function posForVictimFromLine(victim: string, line: string): Position2D | null {
  const positionPattern = new RegExp(
    `Player\\s+["'“”]${escapeRegExp(victim)}["'“”][^\\n]*?pos=<\\s*([0-9.]+)\\s*,\\s*([0-9.]+)\\s*,\\s*([0-9.\\-]+)\\s*>`,
    "i"
  );

  const match = line.match(positionPattern);

  if (match) {
    return {
      x: Number(match[1]),
      y: Number(match[2]),
    };
  }

  const lastPosition = lastPosByName.get(victim);

  return lastPosition
    ? {
        x: lastPosition.x,
        y: lastPosition.y,
      }
    : null;
}
