// src/storage/linkedGamertagsStore.js — Manages Discord user ID to DayZ gamertag links

const { loadJSON, saveJSON } = require("./jsonStore");
const { resolveProjectPath } = require("../config/projectPaths");

const LINKED_GAMERTAGS_FILE = resolveProjectPath("data", "linked-gamertags.json");

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
 * Find the owner of a gamertag in an existing links object.
 * Tries exact match first, then a unique case-insensitive match.
 * @param {Object} links - Map of Discord user ID to gamertag
 * @param {string} gamertag - Gamertag to search for
 * @returns {string|null} Discord user ID or null
 */
function findGamertagOwner(links, gamertag) {
  const trimmedGamertag = String(gamertag || "").trim();

  if (!trimmedGamertag) {
    return null;
  }

  for (const [userId, linkedTag] of Object.entries(links)) {
    if (linkedTag === trimmedGamertag) {
      return userId;
    }
  }

  const lowercaseSearch = trimmedGamertag.toLowerCase();
  const matches = Object.entries(links).filter(
    ([, linkedTag]) => linkedTag.toLowerCase() === lowercaseSearch
  );

  return matches.length === 1 ? matches[0][0] : null;
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
  return findGamertagOwner(links, gamertag);
}

module.exports = {
  loadLinkedGamertags,
  saveLinkedGamertags,
  linkGamertag,
  unlinkGamertag,
  getGamertagByDiscordUserId,
  findGamertagOwner,
  getDiscordUserIdByGamertag,
};
