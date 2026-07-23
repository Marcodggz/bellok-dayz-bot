// Kill event deduplication logic for 20-second buckets with persistent tracking

const { loadState, saveState } = require("../../storage/stateStore");

// Private: 20-second bucket window
const BUCKET_S = 20;

// Private: 1-hour TTL for sent buckets
const SENT_TTL_MS = 60 * 60 * 1000;

// Safety limit in case invalid or future timestamps prevent normal TTL cleanup
const MAX_SENT_BUCKETS = 1000;

function loadSentBuckets() {
  const state = loadState();
  const persistedBuckets = state.sentBuckets;

  if (
    !persistedBuckets ||
    typeof persistedBuckets !== "object" ||
    Array.isArray(persistedBuckets)
  ) {
    return new Map();
  }

  return new Map(
    Object.entries(persistedBuckets).filter(([key, timestamp]) => key && Number.isFinite(timestamp))
  );
}

// Private: In-memory cache loaded from persisted state on startup
const sentBuckets = loadSentBuckets();

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

function cleanupSentBuckets(now = Date.now()) {
  for (const [key, timestamp] of sentBuckets) {
    if (now - timestamp > SENT_TTL_MS) {
      sentBuckets.delete(key);
    }
  }

  if (sentBuckets.size <= MAX_SENT_BUCKETS) {
    return;
  }

  const oldestEntries = [...sentBuckets.entries()].sort(([, a], [, b]) => a - b);
  const entriesToRemove = oldestEntries.slice(0, sentBuckets.size - MAX_SENT_BUCKETS);

  for (const [key] of entriesToRemove) {
    sentBuckets.delete(key);
  }
}

function persistSentBuckets() {
  const state = loadState();
  state.sentBuckets = Object.fromEntries(sentBuckets);
  saveState(state);
}

function hasSentBucket(key) {
  cleanupSentBuckets();
  return sentBuckets.has(key);
}

function markSentBucket(key) {
  const now = Date.now();

  cleanupSentBuckets(now);
  sentBuckets.set(key, now);
  cleanupSentBuckets(now);
  persistSentBuckets();
}

// Backward-compatible API used by existing callers and tests
function alreadySentBucket(key) {
  if (hasSentBucket(key)) {
    return true;
  }

  markSentBucket(key);
  return false;
}

cleanupSentBuckets();
persistSentBuckets();

module.exports = {
  typeRank,
  victimBucketKey,
  hasSentBucket,
  markSentBucket,
  alreadySentBucket,
};
