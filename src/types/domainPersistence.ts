import type { PlayerStats } from "./domainEvents";

export interface FileTailState {
  size: number;
  carry: string;
}

export type SentBuckets = Record<string, number>;

export type KillfeedStateValue = FileTailState | SentBuckets | undefined;

export type KillfeedState = Record<string, KillfeedStateValue> & {
  sentBuckets?: SentBuckets;
};

export type PersistedPlayerStats = Partial<PlayerStats>;

export type PersistedPlayerStatsCollection = Record<string, PersistedPlayerStats>;

export interface PlayerStatsSearchResult {
  gamertag: string;
  stats: PersistedPlayerStats;
}

export type LinkedGamertags = Record<string, string>;
