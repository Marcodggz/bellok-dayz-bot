// src/features/stats/playerStats.js — Player statistics tracking

/**
 * Create an empty stats object
 * @returns {Object} - Empty stats structure keyed by player name
 */
function createEmptyStats() {
  return {};
}

/**
 * Update stats based on a kill event
 * @param {Object} stats - Current stats object (will be mutated)
 * @param {Object} event - Parsed kill event from parseKill
 * @param {number} normalizedEventTimeMs - Normalized chronological event time in milliseconds
 */
function updateStatsFromEvent(stats, event, normalizedEventTimeMs = null) {
  if (!event || !event.type) return;

  if (event.type === "pvp") {
    // Update killer stats
    if (event.killer) {
      const killerStats = ensurePlayerStats(stats, event.killer);
      killerStats.kills++;
      killerStats.killStreak++;

      // Track headshots
      if (event.hitZone && event.hitZone === "Head") {
        killerStats.headshots++;
      }

      // Track longest kill (backward compatible with existing players)
      const currentLongest = killerStats.longestKill ?? 0;
      if (event.distanceMeters && event.distanceMeters > currentLongest) {
        killerStats.longestKill = event.distanceMeters;
        killerStats.longestKillWeapon = event.weapon || "Unknown";
      }

      // Recalculate KD and score
      killerStats.kd = calculateKD(killerStats.kills, killerStats.deaths);
      killerStats.score = calculateScore(killerStats);
      killerStats.rank = calculateRank(killerStats.score);
    }

    // Update victim stats
    if (event.victim) {
      const victimStats = ensurePlayerStats(stats, event.victim);

      // Calculate and store victim time alive
      if (
        victimStats.isConnected &&
        victimStats.connectedSince !== null &&
        normalizedEventTimeMs !== null
      ) {
        const sessionMs = normalizedEventTimeMs - victimStats.connectedSince;
        const totalAliveMs = victimStats.accumulatedAliveMs + sessionMs;
        victimStats.lastTimeAlive = formatTimeAlive(totalAliveMs);

        // Accumulate total played time (does NOT reset on death)
        victimStats.accumulatedPlayedMs =
          (victimStats.accumulatedPlayedMs ?? 0) + sessionMs;

        // Reset accumulated time and restart from death time
        victimStats.accumulatedAliveMs = 0;
        victimStats.connectedSince = normalizedEventTimeMs; // Respawn starts now
      } else {
        // No connection info - cannot calculate time alive
        victimStats.lastTimeAlive = "N/A";
        console.warn(
          `[mock-parse] WARNING: No connection info for victim ${event.victim}. Time Alive set to N/A.`,
        );
      }

      victimStats.deaths++;
      victimStats.killStreak = 0; // Reset kill streak on death

      // Recalculate KD and score
      victimStats.kd = calculateKD(victimStats.kills, victimStats.deaths);
      victimStats.score = calculateScore(victimStats);
      victimStats.rank = calculateRank(victimStats.score);
    }
  } else if (event.type === "explosion") {
    // Update victim stats for explosion deaths
    if (event.victim) {
      const victimStats = ensurePlayerStats(stats, event.victim);

      // Calculate and store victim time alive
      if (
        victimStats.isConnected &&
        victimStats.connectedSince !== null &&
        normalizedEventTimeMs !== null
      ) {
        const sessionMs = normalizedEventTimeMs - victimStats.connectedSince;
        const totalAliveMs = victimStats.accumulatedAliveMs + sessionMs;
        victimStats.lastTimeAlive = formatTimeAlive(totalAliveMs);

        // Accumulate total played time (does NOT reset on death)
        victimStats.accumulatedPlayedMs =
          (victimStats.accumulatedPlayedMs ?? 0) + sessionMs;

        // Reset accumulated time and restart from death time
        victimStats.accumulatedAliveMs = 0;
        victimStats.connectedSince = normalizedEventTimeMs; // Respawn starts now
      } else {
        // No connection info - cannot calculate time alive
        victimStats.lastTimeAlive = "N/A";
        console.warn(
          `[mock-parse] WARNING: No connection info for victim ${event.victim}. Time Alive set to N/A.`,
        );
      }

      victimStats.deaths++;
      victimStats.killStreak = 0; // Reset kill streak on death

      // Recalculate KD and score
      victimStats.kd = calculateKD(victimStats.kills, victimStats.deaths);
      victimStats.score = calculateScore(victimStats);
      victimStats.rank = calculateRank(victimStats.score);
    }
  }
}

/**
 * Get stats for a specific player
 * @param {Object} stats - Current stats object
 * @param {string} playerName - Name of the player
 * @returns {Object|null} - Player stats or null if not found
 */
function getPlayerStats(stats, playerName) {
  if (!stats || !playerName) return null;
  return stats[playerName] || null;
}

/**
 * Ensure a player has stats initialized
 * @param {Object} stats - Current stats object
 * @param {string} playerName - Name of the player
 * @returns {Object} - Player stats object
 */
function ensurePlayerStats(stats, playerName) {
  if (!stats[playerName]) {
    stats[playerName] = {
      kills: 0,
      deaths: 0,
      headshots: 0,
      kd: 0.0,
      killStreak: 0,
      score: 0.0,
      rank: "Private",
      // Longest kill tracking
      longestKill: 0,
      longestKillWeapon: null,
      // Time Alive tracking
      connectedSince: null, // Timestamp when player connected
      accumulatedAliveMs: 0, // Total time alive accumulated across sessions
      isConnected: false, // Whether player is currently connected
      lastTimeAlive: null, // Last calculated time alive (formatted string)
      // Time Played tracking
      accumulatedPlayedMs: 0, // Total time played accumulated across all sessions
    };
  }
  return stats[playerName];
}

/**
 * Calculate K/D ratio with cap at 10.00
 * @param {number} kills - Number of kills
 * @param {number} deaths - Number of deaths
 * @returns {number} - K/D ratio formatted to 2 decimals, capped at 10.00
 */
function calculateKD(kills, deaths) {
  const kd = kills / Math.max(deaths, 1);
  const capped = Math.min(kd, 10.0);
  return parseFloat(capped.toFixed(2));
}

/**
 * Calculate score based on kills, headshots, kill streak, deaths, and KD
 * @param {Object} playerStats - Player stats object
 * @returns {number} - Calculated score formatted to 1 decimal
 */
function calculateScore(playerStats) {
  const { kills, headshots, killStreak, deaths, kd } = playerStats;

  // New score formula - less aggressive scale
  const score =
    kills * 1.5 +
    Math.sqrt(kills) * 10 +
    headshots * 0.5 +
    killStreak * 4 +
    kd * 20 -
    deaths * 0.5;

  // Clamp score to minimum 0
  const finalScore = Math.max(0, score);

  // Format to 1 decimal place
  return parseFloat(finalScore.toFixed(1));
}

/**
 * Calculate rank based on score
 * @param {number} score - Player score
 * @returns {string} - Rank name
 */
function calculateRank(score) {
  if (score >= 800) return "Specialist";
  if (score >= 500) return "Corporal";
  if (score >= 250) return "Lance Corporal";
  if (score >= 100) return "Private First Class";
  return "Private";
}

/**
 * Parse event time from HH:MM:SS format to milliseconds since midnight
 * @param {string} timeStr - Time string in HH:MM:SS format
 * @returns {number|null} - Milliseconds since midnight, or null if invalid
 */
function parseEventTime(timeStr) {
  if (!timeStr) return null;
  const match = timeStr.match(/^(\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return null;

  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const seconds = parseInt(match[3], 10);

  return (hours * 3600 + minutes * 60 + seconds) * 1000;
}

/**
 * Format time alive from milliseconds to display format
 * @param {number} ms - Milliseconds alive
 * @returns {string} - Formatted time string (e.g., "01D 02H 33M 04S" or "03H 04M 00S")
 */
function formatTimeAlive(ms) {
  if (ms === null || ms === undefined || ms < 0) return "N/A";

  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${String(days).padStart(2, "0")}D ${String(hours).padStart(2, "0")}H ${String(minutes).padStart(2, "0")}M ${String(seconds).padStart(2, "0")}S`;
  } else {
    return `${String(hours).padStart(2, "0")}H ${String(minutes).padStart(2, "0")}M ${String(seconds).padStart(2, "0")}S`;
  }
}

/**
 * Handle player connection event
 * @param {Object} stats - Current stats object (will be mutated)
 * @param {string} playerName - Name of the player
 * @param {number} normalizedConnectTimeMs - Normalized chronological connection time in milliseconds
 */
function handlePlayerConnect(stats, playerName, normalizedConnectTimeMs) {
  const playerStats = ensurePlayerStats(stats, playerName);

  if (normalizedConnectTimeMs !== null) {
    playerStats.isConnected = true;
    playerStats.connectedSince = normalizedConnectTimeMs;
    // Do NOT reset accumulatedAliveMs - reconnect continues same life
  }
}

/**
 * Handle player disconnection event
 * @param {Object} stats - Current stats object (will be mutated)
 * @param {string} playerName - Name of the player
 * @param {number} normalizedDisconnectTimeMs - Normalized chronological disconnection time in milliseconds
 */
function handlePlayerDisconnect(stats, playerName, normalizedDisconnectTimeMs) {
  const playerStats = ensurePlayerStats(stats, playerName);

  if (
    playerStats.isConnected &&
    playerStats.connectedSince !== null &&
    normalizedDisconnectTimeMs !== null
  ) {
    // Accumulate session time
    const sessionMs = normalizedDisconnectTimeMs - playerStats.connectedSince;
    playerStats.accumulatedAliveMs += sessionMs;
    // Accumulate total played time (does NOT reset on death)
    playerStats.accumulatedPlayedMs =
      (playerStats.accumulatedPlayedMs ?? 0) + sessionMs;
  }

  playerStats.isConnected = false;
  playerStats.connectedSince = null;
  // Do NOT reset accumulatedAliveMs - disconnect pauses life, doesn't reset it
}

// ================== EXPORTS ==================
module.exports = {
  createEmptyStats,
  updateStatsFromEvent,
  getPlayerStats,
  handlePlayerConnect,
  handlePlayerDisconnect,
};
