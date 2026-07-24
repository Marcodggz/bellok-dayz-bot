// Kill event deduplication logic for 20-second buckets with persistent tracking

import { loadState, saveState } from "../../storage/stateStore";
import type { KillfeedState, SentBuckets } from "../../types/domainPersistence";

const BUCKET_SECONDS = 20;
const SENT_BUCKET_TTL_MS = 60 * 60 * 1000;
const MAX_SENT_BUCKETS = 1000;

function loadSentBuckets(): Map<string, number> {
  const state = loadState() as KillfeedState;
  const persistedBuckets = state.sentBuckets;

  if (
    !persistedBuckets ||
    typeof persistedBuckets !== "object" ||
    Array.isArray(persistedBuckets)
  ) {
    return new Map();
  }

  const validEntries = Object.entries(persistedBuckets).filter(
    ([key, timestamp]) => key.length > 0 && Number.isFinite(timestamp)
  );

  return new Map(validEntries);
}

const sentBuckets = loadSentBuckets();

function timeToSeconds(time: string | null): number | null {
  if (!time) {
    return null;
  }

  const [hours, minutes, seconds] = time.split(":").map(Number);

  if ([hours, minutes, seconds].some(Number.isNaN)) {
    return null;
  }

  return hours * 3600 + minutes * 60 + seconds;
}

export function typeRank(type: unknown): number {
  if (type === "pvp") {
    return 2;
  }

  if (type === "explosion") {
    return 1;
  }

  return 0;
}

export function victimBucketKey(victim: string | null, time: string | null): string {
  const seconds = timeToSeconds(time);

  const bucket =
    seconds === null
      ? Math.floor(Date.now() / 1000 / BUCKET_SECONDS)
      : Math.floor(seconds / BUCKET_SECONDS);

  return `${victim}|${bucket}`;
}

function cleanupSentBuckets(now: number = Date.now()): void {
  for (const [key, timestamp] of sentBuckets) {
    if (now - timestamp > SENT_BUCKET_TTL_MS) {
      sentBuckets.delete(key);
    }
  }

  if (sentBuckets.size <= MAX_SENT_BUCKETS) {
    return;
  }

  const oldestEntries = [...sentBuckets.entries()].sort(
    ([, firstTimestamp], [, secondTimestamp]) => firstTimestamp - secondTimestamp
  );

  const entriesToRemove = oldestEntries.slice(0, sentBuckets.size - MAX_SENT_BUCKETS);

  for (const [key] of entriesToRemove) {
    sentBuckets.delete(key);
  }
}

function persistSentBuckets(): void {
  const state = loadState() as KillfeedState;

  state.sentBuckets = Object.fromEntries(sentBuckets) as SentBuckets;

  saveState(state);
}

export function hasSentBucket(key: string): boolean {
  cleanupSentBuckets();

  return sentBuckets.has(key);
}

export function markSentBucket(key: string): void {
  const now = Date.now();

  cleanupSentBuckets(now);
  sentBuckets.set(key, now);
  cleanupSentBuckets(now);
  persistSentBuckets();
}

export function alreadySentBucket(key: string): boolean {
  if (hasSentBucket(key)) {
    return true;
  }

  markSentBucket(key);

  return false;
}

cleanupSentBuckets();
persistSentBuckets();
