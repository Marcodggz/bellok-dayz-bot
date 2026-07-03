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
 */
function updateStatsFromEvent(stats, event) {
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

      // Recalculate KD and score
      killerStats.kd = calculateKD(killerStats.kills, killerStats.deaths);
      killerStats.score = calculateScore(killerStats);
      killerStats.rank = calculateRank(killerStats.score);
    }

    // Update victim stats
    if (event.victim) {
      const victimStats = ensurePlayerStats(stats, event.victim);
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
 * Calculate score based on kills, headshots, kill streak, deaths, and KD multiplier
 * @param {Object} playerStats - Player stats object
 * @returns {number} - Calculated score formatted to 1 decimal
 */
function calculateScore(playerStats) {
  const { kills, headshots, killStreak, deaths, kd } = playerStats;

  // Base score calculation
  const baseScore =
    kills * 100 + headshots * 15 + killStreak * 20 - deaths * 80;

  // Apply KD multiplier
  let multiplier = 1.0;
  if (kd < 0.5) {
    multiplier = 0.8;
  } else if (kd >= 0.5 && kd < 1) {
    multiplier = 1.0;
  } else if (kd >= 1 && kd < 2) {
    multiplier = 1.1;
  } else if (kd >= 2 && kd < 3) {
    multiplier = 1.2;
  } else if (kd >= 3) {
    multiplier = 1.3;
  }

  // Calculate final score (never below 0)
  const finalScore = Math.max(0, baseScore * multiplier);

  // Format to 1 decimal place
  return parseFloat(finalScore.toFixed(1));
}

/**
 * Calculate rank based on score
 * @param {number} score - Player score
 * @returns {string} - Rank name
 */
function calculateRank(score) {
  if (score >= 10000) return "Captain";
  if (score >= 6000) return "Lieutenant";
  if (score >= 3000) return "Sergeant";
  if (score >= 1500) return "Corporal";
  if (score >= 500) return "Private First Class";
  return "Private";
}

// ================== EXPORTS ==================
module.exports = {
  createEmptyStats,
  updateStatsFromEvent,
  getPlayerStats,
};
