// src/config/config.js — Environment variables & constants
require("dotenv").config();

// ================== NITRADO CONFIG ==================
const NIT_API = "https://api.nitrado.net";
const SERVICE_ID = process.env.NITRADO_SERVICE_ID;
const NIT_TOKEN = process.env.NITRADO_TOKEN;
const ADM_DIR = process.env.NITRADO_ADM_DIR || "";

// ================== DISCORD CONFIG ==================
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const HEATMAP_CHANNEL_ID = process.env.HEATMAP_CHANNEL_ID || "";
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const SERVER_NAME = process.env.SERVER_NAME || "Bellok DayZ Server";

// ================== POLLING & BEHAVIOR ==================
const START_AT_END = process.env.START_AT_END === "1";
const RAW_TO_DISCORD = process.env.RAW_TO_DISCORD === "1";
const DEBUG = process.env.DEBUG_KILLS === "1";
const DEBUG_TICKS = process.env.DEBUG_TICKS === "1";
const POLL_MS = Number(process.env.POLL_MS || 5000);
const ROTATE_CHECK_MS = Number(process.env.ROTATE_CHECK_MS || 60000);
const LIST_COOLDOWN_MS = Number(process.env.LIST_COOLDOWN_MS || 120000);

// ================== HEATMAP CONFIG ==================
const HEATMAP_INTERVAL_MS = Number(process.env.HEATMAP_INTERVAL_MS || 600000);
const HEATMAP_WIDTH = Number(process.env.HEATMAP_WIDTH || 512);
const HEATMAP_HEIGHT = Number(process.env.HEATMAP_HEIGHT || 512);
const MAP_SIZE = Number(process.env.MAP_SIZE || 15360);
const HEATMAP_WINDOW_MIN = Number(process.env.HEATMAP_WINDOW_MIN || 720);
const HEATMAP_RESET_ON_ROTATE = process.env.HEATMAP_RESET_ON_ROTATE === "1";
const MAP_IMAGE_PATH = process.env.MAP_IMAGE_PATH || "";
const MAP_DISPLAY_NAME = process.env.MAP_DISPLAY_NAME || "Livonia";
const IZURVIVE_MAP_SLUG = process.env.IZURVIVE_MAP_SLUG || "livonia";

// ================== MAP CALIBRATION ==================
const MAP_MIN_X = Number(process.env.MAP_MIN_X || 0);
const MAP_MAX_X = Number(process.env.MAP_MAX_X || MAP_SIZE);
const MAP_MIN_Y = Number(process.env.MAP_MIN_Y || 0);
const MAP_MAX_Y = Number(process.env.MAP_MAX_Y || MAP_SIZE);
const MAP_FLIP_Y = (process.env.MAP_FLIP_Y ?? "1") !== "0";
const MAP_OFFSET_X = Number(process.env.MAP_OFFSET_X || 0);
const MAP_OFFSET_Y = Number(process.env.MAP_OFFSET_Y || 0);
const MAP_SCALE_X = Number(process.env.MAP_SCALE_X || 1);
const MAP_SCALE_Y = Number(process.env.MAP_SCALE_Y || 1);

// ================== HEATMAP VISUAL ==================
const HEAT_RADIUS = Number(process.env.HEAT_RADIUS || 0);
const HEAT_GAMMA = Number(process.env.HEAT_GAMMA || 0.6);
const HEAT_MIN_ALPHA = Number(process.env.HEAT_MIN_ALPHA || 70);
const HEAT_HALFLIFE_MIN = Number(process.env.HEAT_HALFLIFE_MIN || 60);
const HEAT_NORM_PERCENTILE = Number(process.env.HEAT_NORM_PERCENTILE || 0.9);
const HEAT_RECENT_MIN = Number(process.env.HEAT_RECENT_MIN || 10);
const HEAT_RECENT_DOT_RADIUS = Number(process.env.HEAT_RECENT_DOT_RADIUS || 6);
const HEAT_RECENT_DOT_ALPHA = Number(process.env.HEAT_RECENT_DOT_ALPHA || 230);

// ================== FILE PATHS ==================
const STATE_FILE = "./state.json";
const HEAT_STATE_FILE = "./heatmap.json";
const HEAT_IMG_PATH = "./heatmap.png";

// ================== WEEKEND HEATMAP CONFIG ==================
const WEEKEND_HEATMAP_CHANNEL_ID =
  process.env.WEEKEND_HEATMAP_CHANNEL_ID || "1425480569562730629";
const WEEKEND_HEATMAP_INTERVAL_MS =
  Number(process.env.WEEKEND_HEATMAP_INTERVAL_MS) || 15 * 60 * 1000;
const WEEKEND_HEATMAP_WINDOW_MIN = Number(
  process.env.WEEKEND_HEATMAP_WINDOW_MIN || 60,
);
const WEEKEND_HEATMAP_STATE_FILE =
  process.env.WEEKEND_HEATMAP_STATE_FILE || "./weekend-heatmap.json";
const WEEKEND_HEATMAP_IMG_PATH =
  process.env.WEEKEND_HEATMAP_IMG_PATH || "./weekend-heatmap.png";

module.exports = {
  // Nitrado
  NIT_API,
  SERVICE_ID,
  NIT_TOKEN,
  ADM_DIR,

  // Discord
  CHANNEL_ID,
  HEATMAP_CHANNEL_ID,
  DISCORD_TOKEN: process.env.DISCORD_TOKEN,
  CLIENT_ID,
  SERVER_NAME,

  // Polling
  START_AT_END,
  RAW_TO_DISCORD,
  DEBUG,
  DEBUG_TICKS,
  POLL_MS,
  ROTATE_CHECK_MS,
  LIST_COOLDOWN_MS,

  // Heatmap
  HEATMAP_INTERVAL_MS,
  HEATMAP_WIDTH,
  HEATMAP_HEIGHT,
  MAP_SIZE,
  HEATMAP_WINDOW_MIN,
  HEATMAP_RESET_ON_ROTATE,
  MAP_IMAGE_PATH,
  MAP_DISPLAY_NAME,
  IZURVIVE_MAP_SLUG,

  // Map calibration
  MAP_MIN_X,
  MAP_MAX_X,
  MAP_MIN_Y,
  MAP_MAX_Y,
  MAP_FLIP_Y,
  MAP_OFFSET_X,
  MAP_OFFSET_Y,
  MAP_SCALE_X,
  MAP_SCALE_Y,

  // Heatmap visual
  HEAT_RADIUS,
  HEAT_GAMMA,
  HEAT_MIN_ALPHA,
  HEAT_HALFLIFE_MIN,
  HEAT_NORM_PERCENTILE,
  HEAT_RECENT_MIN,
  HEAT_RECENT_DOT_RADIUS,
  HEAT_RECENT_DOT_ALPHA,

  // File paths
  STATE_FILE,
  HEAT_STATE_FILE,
  HEAT_IMG_PATH,

  // Weekend heatmap
  WEEKEND_HEATMAP_CHANNEL_ID,
  WEEKEND_HEATMAP_INTERVAL_MS,
  WEEKEND_HEATMAP_WINDOW_MIN,
  WEEKEND_HEATMAP_STATE_FILE,
  WEEKEND_HEATMAP_IMG_PATH,
};
