// Handle deduplicated kill events: check for duplicates, queue for Discord, extract positions

const { alreadySentBucket } = require("./killEventDeduplicator");
const { queueKillfeedEvent } = require("./killfeedQueue");
const { posForVictimFromLine } = require("../tracking/positionTracker");

/**
 * Handle deduplicated kill events: check for duplicates, queue for Discord, extract positions
 *
 * @param {Map<string, Object>} groups - Map of victimBucketKey -> kill event
 * @param {string[]} lines - Original raw ADM log lines (for line matching)
 * @returns {Array<{x: number, y: number}>} Valid heatmap positions to add
 *
 * Side effects:
 * - Marks buckets as sent via alreadySentBucket()
 * - Queues events for Discord via queueKillfeedEvent()
 *
 * Processing steps:
 * 1. Check if bucket already sent (skip if yes)
 * 2. Find matching raw log line by victim + timestamp
 * 3. Queue event with kill data + raw line
 * 4. Extract victim position from line
 * 5. Validate coordinates and collect for heatmap
 */
function handleKillEvents(groups, lines) {
  const heatmapPoints = [];

  for (const [key, k] of groups) {
    if (alreadySentBucket(key)) continue;

    queueKillfeedEvent(
      {
        kill: k,
        line: lines.find(
          (l) =>
            l.includes(`"${k.victim}"`) && (k.t ? l.startsWith(k.t) : true),
        ),
      },
      key,
    );

    const pos = posForVictimFromLine(k.victim, k.line || "");
    if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
      heatmapPoints.push(pos);
    }
  }

  return heatmapPoints;
}

module.exports = {
  handleKillEvents,
};
