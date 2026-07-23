import type { Position2D } from "./domainEvents";

export type HeatPoint = Position2D;

export interface TrackedPlayerPosition extends Position2D {
  name: string;
  ts: number;
}

export interface HeatCluster extends Position2D {
  count: number;
}

export interface HeatState {
  points: HeatPoint[];
  lastSentCount: number;
  messageId: string | null;
  lastUpdate: number;
}

export interface WeekendHeatState {
  points: TrackedPlayerPosition[];
  messageId: string | null;
  lastUpdate: number;
}
