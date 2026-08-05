// src/config/config.ts — Environment variables & constants
import "dotenv/config";

// ================== NITRADO CONFIG ==================
export const NIT_API = "https://api.nitrado.net";
export const SERVICE_ID = process.env.NITRADO_SERVICE_ID;
export const NIT_TOKEN = process.env.NITRADO_TOKEN;
export const ADM_DIR = process.env.NITRADO_ADM_DIR || "";

// ================== DISCORD CONFIG ==================
export const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
export const HEATMAP_CHANNEL_ID = process.env.HEATMAP_CHANNEL_ID || "";
export const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
export const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
export const SERVER_NAME = process.env.SERVER_NAME || "Bellok DayZ Server";

// ================== POLLING & BEHAVIOR ==================
export const START_AT_END = process.env.START_AT_END === "1";
export const RAW_TO_DISCORD = process.env.RAW_TO_DISCORD === "1";
export const DEBUG = process.env.DEBUG_KILLS === "1";
export const DEBUG_TICKS = process.env.DEBUG_TICKS === "1";
export const POLL_MS = Number(process.env.POLL_MS || 5000);
export const ROTATE_CHECK_MS = Number(process.env.ROTATE_CHECK_MS || 60000);
export const LIST_COOLDOWN_MS = Number(process.env.LIST_COOLDOWN_MS || 120000);
export const ADM_TIME_OFFSET_MINUTES = Number(process.env.ADM_TIME_OFFSET_MINUTES || 0);

// ================== HEATMAP CONFIG ==================
export const HEATMAP_INTERVAL_MS = Number(process.env.HEATMAP_INTERVAL_MS || 900000);
export const HEATMAP_WIDTH = Number(process.env.HEATMAP_WIDTH || 512);
export const HEATMAP_HEIGHT = Number(process.env.HEATMAP_HEIGHT || 512);
export const MAP_SIZE = Number(process.env.MAP_SIZE || 15360);
export const HEATMAP_WINDOW_MIN = Number(process.env.HEATMAP_WINDOW_MIN || 15);
export const HEATMAP_RESET_ON_ROTATE = process.env.HEATMAP_RESET_ON_ROTATE === "1";
export const MAP_IMAGE_PATH = process.env.MAP_IMAGE_PATH || "";
export const MAP_DISPLAY_NAME = process.env.MAP_DISPLAY_NAME || "Livonia";
export const IZURVIVE_MAP_SLUG = process.env.IZURVIVE_MAP_SLUG || "livonia";

// ================== MAP CALIBRATION ==================
export const MAP_MIN_X = Number(process.env.MAP_MIN_X || 0);
export const MAP_MAX_X = Number(process.env.MAP_MAX_X || MAP_SIZE);
export const MAP_MIN_Y = Number(process.env.MAP_MIN_Y || 0);
export const MAP_MAX_Y = Number(process.env.MAP_MAX_Y || MAP_SIZE);
export const MAP_FLIP_Y = (process.env.MAP_FLIP_Y ?? "1") !== "0";
export const MAP_OFFSET_X = Number(process.env.MAP_OFFSET_X || 0);
export const MAP_OFFSET_Y = Number(process.env.MAP_OFFSET_Y || 0);
export const MAP_SCALE_X = Number(process.env.MAP_SCALE_X || 1);
export const MAP_SCALE_Y = Number(process.env.MAP_SCALE_Y || 1);
export const MAP_PIX_INSET_L = Number(process.env.MAP_PIX_INSET_L || 0);
export const MAP_PIX_INSET_R = Number(process.env.MAP_PIX_INSET_R || 0);
export const MAP_PIX_INSET_T = Number(process.env.MAP_PIX_INSET_T || 0);
export const MAP_PIX_INSET_B = Number(process.env.MAP_PIX_INSET_B || 0);

// ================== FILE PATHS ==================
export const STATE_FILE = "./state.json";
export const HEAT_STATE_FILE = "./heatmap.json";
export const HEAT_IMG_PATH = "./heatmap.png";

// ================== WEEKEND HEATMAP CONFIG ==================
export const WEEKEND_HEATMAP_CHANNEL_ID = process.env.WEEKEND_HEATMAP_CHANNEL_ID || "";
export const WEEKEND_HEATMAP_WINDOW_MIN = Number(process.env.WEEKEND_HEATMAP_WINDOW_MIN || 15);
export const WEEKEND_HEATMAP_STATE_FILE =
  process.env.WEEKEND_HEATMAP_STATE_FILE || "./weekend-heatmap.json";
export const WEEKEND_HEATMAP_IMG_PATH =
  process.env.WEEKEND_HEATMAP_IMG_PATH || "./weekend-heatmap.png";
