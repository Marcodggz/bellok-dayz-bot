// Process raw ADM log lines into deduplicated kill event groups

const { parseKill } = require("../../parsers/killParser");
const { updatePositionsFromLine } = require("../tracking/positionTracker");
const { typeRank, victimBucketKey } = require("./killEventDeduplicator");

/**
 * Process raw ADM log lines into deduplicated kill event groups
 *
 * @param {string[]} lines - Raw ADM log lines
 * @returns {Map<string, Object>} Map of victimBucketKey -> highest-priority kill event
 *
 * Side effects:
 * - Updates global position tracker via updatePositionsFromLine()
 *
 * Processing steps:
 * 1. Update positions from all lines (including non-kill lines)
 * 2. Parse kill events from lines (filter nulls)
 * 3. Group by victim + 20s bucket, prioritize PvP > explosion
 */
function processKillEvents(lines) {
  for (const ln of lines) updatePositionsFromLine(ln);

  const events = [];
  for (const ln of lines) {
    const e = parseKill(ln);
    if (e) events.push(e);
  }

  // Group by victim + 20s time bucket, prioritize PvP over explosion
  const groups = new Map();
  for (const k of events) {
    const key = victimBucketKey(k.victim, k.t);
    const cur = groups.get(key);
    if (!cur || typeRank(k.type) > typeRank(cur.type)) groups.set(key, k);
  }

  return groups;
}

module.exports = {
  processKillEvents,
};
