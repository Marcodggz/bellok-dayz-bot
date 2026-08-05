import type { KillEvent, Position2D } from "../../types/domainEvents.js";
import type {
  PersistedPlayerStats,
  PersistedPlayerStatsCollection,
} from "../../types/domainPersistence.js";
import { getPlayerStats, updateStatsFromEvent } from "../stats/playerStats.js";
import { posForVictimFromLine } from "../tracking/positionTracker.js";
import { hasSentBucket } from "./killEventDeduplicator.js";
import { queueKillfeedEvent } from "./killfeedQueue.js";

type SessionLineProcessor = (line: string) => void;

interface QueuedKillEvent {
  key: string;
  kill: KillEvent;
}

export function handleKillEvents(
  groups: Map<string, KillEvent>,
  lines: string[],
  stats: PersistedPlayerStatsCollection | null = null,
  normalizedEventTimes: Map<string, number | null> = new Map(),
  processSessionLine: SessionLineProcessor | null = null
): Position2D[] {
  const heatmapPoints: Position2D[] = [];
  const eventsByLine = new Map<string, QueuedKillEvent>();

  for (const [key, kill] of groups) {
    if (hasSentBucket(key)) {
      continue;
    }

    const matchedLine = lines.find(
      (line) => line.includes(`"${kill.victim}"`) && (kill.t ? line.startsWith(kill.t) : true)
    );

    if (matchedLine) {
      eventsByLine.set(matchedLine, { key, kill });
    }
  }

  for (const line of lines) {
    processSessionLine?.(line);

    const queued = eventsByLine.get(line);

    if (!queued) {
      continue;
    }

    const { key, kill } = queued;

    if (stats) {
      const normalizedEventTimeMs = normalizedEventTimes.get(line) ?? null;

      updateStatsFromEvent(stats, kill, normalizedEventTimeMs);
    }

    const killerStats: PersistedPlayerStats | null =
      stats && kill.type === "pvp" && kill.killer
        ? { ...getPlayerStats(stats, kill.killer) }
        : null;

    const victimStats: PersistedPlayerStats | null =
      stats && kill.victim ? { ...getPlayerStats(stats, kill.victim) } : null;

    queueKillfeedEvent(
      {
        kill,
        line,
        killerStats,
        victimStats,
      },
      key
    );

    const position = kill.victim ? posForVictimFromLine(kill.victim, kill.line || line) : null;

    if (position && Number.isFinite(position.x) && Number.isFinite(position.y)) {
      heatmapPoints.push(position);
    }
  }

  return heatmapPoints;
}
