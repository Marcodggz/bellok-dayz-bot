// src/storage/linkedGamertagsStore.js — Manages Discord user ID to DayZ gamertag links

const { loadJSON, saveJSON } = require("./jsonStore");
const path = require("path");

const LINKED_GAMERTAGS_FILE = path.join(
  __dirname,
  "../../data/linked-gamertags.json",
);

/**
 * Load linked gamertags from file
 * @returns {Object} Map of Discord user ID -> DayZ gamertag
 */
function loadLinkedGamertags() {
  return loadJSON(LINKED_GAMERTAGS_FILE, {});
}

/**
 * Save linked gamertags to file
 * @param {Object} links - Map of Discord user ID -> DayZ gamertag
 */
function saveLinkedGamertags(links) {
  saveJSON(LINKED_GAMERTAGS_FILE, links);
}

/**
 * Link a Discord user ID to a DayZ gamertag
 * @param {string} discordUserId - Discord user ID
 * @param {string} gamertag - DayZ gamertag (casing preserved)
 */
function linkGamertag(discordUserId, gamertag) {
  const links = loadLinkedGamertags();
  links[discordUserId] = gamertag.trim();
  saveLinkedGamertags(links);
}

/**
 * Unlink a Discord user ID from their gamertag
 * @param {string} discordUserId - Discord user ID
 */
function unlinkGamertag(discordUserId) {
  const links = loadLinkedGamertags();
  delete links[discordUserId];
  saveLinkedGamertags(links);
}

/**
 * Get gamertag by Discord user ID
 * @param {string} discordUserId - Discord user ID
 * @returns {string|null} Gamertag or null if not found
 */
function getGamertagByDiscordUserId(discordUserId) {
  const links = loadLinkedGamertags();
  return links[discordUserId] || null;
}

/**
 * Get Discord user ID by gamertag
 * Tries exact match first, then case-insensitive match
 * Returns null if no match or multiple case-insensitive matches found
 * @param {string} gamertag - DayZ gamertag to search for
 * @returns {string|null} Discord user ID or null
 */
function getDiscordUserIdByGamertag(gamertag) {
  const links = loadLinkedGamertags();
  const trimmedGamertag = gamertag.trim();

  // Try exact match first
  for (const [userId, linkedTag] of Object.entries(links)) {
    if (linkedTag === trimmedGamertag) {
      return userId;
    }
  }

  // Fallback to case-insensitive match
  const lowercaseSearch = trimmedGamertag.toLowerCase();
  const matches = [];

  for (const [userId, linkedTag] of Object.entries(links)) {
    if (linkedTag.toLowerCase() === lowercaseSearch) {
      matches.push(userId);
    }
  }

  // Return result only if exactly one match found
  // Multiple matches indicate a conflict, so return null
  return matches.length === 1 ? matches[0] : null;
}

module.exports = {
  loadLinkedGamertags,
  saveLinkedGamertags,
  linkGamertag,
  unlinkGamertag,
  getGamertagByDiscordUserId,
  getDiscordUserIdByGamertag,
};
