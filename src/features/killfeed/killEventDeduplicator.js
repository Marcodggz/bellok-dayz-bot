// Kill event deduplication logic for 20-second buckets with priority ranking

// Private: 20-second bucket window
const BUCKET_S = 20;

// Private: 1-hour TTL for sent buckets
const SENT_TTL_MS = 60 * 60 * 1000;

// Private: In-memory tracking of sent buckets
const sentBuckets = new Map();

// Private: Convert "HH:MM:SS" to seconds, null on invalid
function timeToSec(t) {
  if (!t) return null;
  const [hh, mm, ss] = t.split(":").map(Number);
  if ([hh, mm, ss].some(Number.isNaN)) return null;
  return hh * 3600 + mm * 60 + ss;
}

// Public: Event priority ranking (pvp > explosion > unknown)
function typeRank(tp) {
  return tp === "pvp" ? 2 : tp === "explosion" ? 1 : 0;
}

// Public: Generate bucket key for victim + 20s time window
function victimBucketKey(victim, t) {
  const s = timeToSec(t);
  const b = s == null ? Math.floor(Date.now() / 1000 / BUCKET_S) : Math.floor(s / BUCKET_S);
  return `${victim}|${b}`;
}

// Public: Check if bucket already sent, mark it, cleanup expired entries
function alreadySentBucket(key) {
  const now = Date.now();
  for (const [kk, ts] of sentBuckets) if (now - ts > SENT_TTL_MS) sentBuckets.delete(kk);
  if (sentBuckets.has(key)) return true;
  sentBuckets.set(key, now);
  return false;
}

module.exports = {
  typeRank,
  victimBucketKey,
  alreadySentBucket,
};
