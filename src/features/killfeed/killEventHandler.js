// Handle deduplicated kill events: update stats, queue Discord events, extract positions

const { hasSentBucket } = require("./killEventDeduplicator");
const { queueKillfeedEvent } = require("./killfeedQueue");
const { posForVictimFromLine } = require("../tracking/positionTracker");
const { updateStatsFromEvent, getPlayerStats } = require("../stats/playerStats");

/**
 * Handle deduplicated kill events.
 *
 * @param {Map<string, Object>} groups
 * @param {string[]} lines
 * @param {Object|null} stats
 * @param {Map<string, number|null>} normalizedEventTimes
 * @returns {Array<{x: number, y: number}>}
 */
function handleKillEvents(
  groups,
  lines,
  stats = null,
  normalizedEventTimes = new Map(),
  processSessionLine = null
) {
  const heatmapPoints = [];
  const eventsByLine = new Map();

  for (const [key, kill] of groups) {
    if (hasSentBucket(key)) continue;

    const matchedLine = lines.find(
      (line) => line.includes(`"${kill.victim}"`) && (kill.t ? line.startsWith(kill.t) : true)
    );

    if (matchedLine) {
      eventsByLine.set(matchedLine, { key, kill });
    }
  }

  for (const line of lines) {
    if (processSessionLine) {
      processSessionLine(line);
    }

    const queued = eventsByLine.get(line);
    if (!queued) continue;

    const { key, kill } = queued;

    if (stats) {
      const normalizedEventTimeMs = normalizedEventTimes.get(line) ?? null;

      updateStatsFromEvent(stats, kill, normalizedEventTimeMs);
    }

    const killerStats = stats && kill.killer ? { ...getPlayerStats(stats, kill.killer) } : null;

    const victimStats = stats && kill.victim ? { ...getPlayerStats(stats, kill.victim) } : null;

    queueKillfeedEvent(
      {
        kill,
        line,
        killerStats,
        victimStats,
      },
      key
    );

    const pos = posForVictimFromLine(kill.victim, kill.line || line);

    if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
      heatmapPoints.push(pos);
    }
  }

  return heatmapPoints;
}

module.exports = {
  handleKillEvents,
};
