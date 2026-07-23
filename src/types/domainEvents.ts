export type PlayerRank =
  "Private" | "Private First Class" | "Lance Corporal" | "Corporal" | "Specialist";

export interface PlayerStats {
  kills: number;
  deaths: number;
  headshots: number;
  kd: number;
  killStreak: number;
  score: number;
  rank: PlayerRank;
  longestKill: number;
  longestKillWeapon: string | null;
  connectedSince: number | null;
  accumulatedAliveMs: number;
  isConnected: boolean;
  lastTimeAlive: string | null;
  accumulatedPlayedMs: number;
}

export type PlayerStatsCollection = Record<string, PlayerStats>;

export interface Position2D {
  x: number;
  y: number;
}

export interface Position3D extends Position2D {
  z: number;
}

interface BaseKillEvent {
  victim: string | null;
  t: string | null;
  line: string;
  victimPosition?: Position3D;
}

export interface PvPKillEvent extends BaseKillEvent {
  type: "pvp";
  killer: string | null;
  weapon: string | null;
  distanceMeters: number | null;
  ammo: string | null;
  hitZone: string | null;
  damage: number | null;
  killerPosition?: Position3D;
}

export interface ExplosionKillEvent extends BaseKillEvent {
  type: "explosion";
  device: string | null;
}

export type KillEvent = PvPKillEvent | ExplosionKillEvent;

export interface ConnectSessionEvent {
  type: "connect";
  playerName: string;
  normalizedTimeMs: number | null;
}

export interface DisconnectSessionEvent {
  type: "disconnect";
  playerName: string;
  normalizedTimeMs: number | null;
}

export interface NoSessionEvent {
  type: null;
  playerName: null;
  normalizedTimeMs: number | null;
}

export type PlayerSessionEvent = ConnectSessionEvent | DisconnectSessionEvent | NoSessionEvent;
