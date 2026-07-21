// src/utils/rankBadges.js — Map ranks to badge images
const fs = require("fs");
const path = require("path");

/**
 * Map rank names to their corresponding badge image paths
 */
const RANK_BADGE_MAP = {
  Private: "private.png",
  "Private First Class": "private-first-class.png",
  "Lance Corporal": "lance-corporal.png",
  Corporal: "corporal.png",
  Specialist: "specialist.png",
};

/**
 * Get the badge image path for a given rank
 * @param {string} rank - The rank name
 * @returns {string|null} - Absolute path to badge image, or null if not found/doesn't exist
 */
function getRankBadgePath(rank) {
  const badgeFilename = RANK_BADGE_MAP[rank];
  if (!badgeFilename) {
    return null;
  }

  const badgePath = path.join(__dirname, "..", "assets", "ranks", badgeFilename);

  // Check if file exists before returning
  try {
    if (fs.existsSync(badgePath)) {
      return badgePath;
    }
  } catch (error) {
    console.error(`[rankBadges] Error checking badge path: ${error.message}`);
  }

  return null;
}

module.exports = {
  getRankBadgePath,
};
