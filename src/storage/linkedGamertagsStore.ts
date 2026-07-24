// Manages Discord user ID to DayZ gamertag links

import { resolveProjectPath } from "../config/projectPaths";
import { loadJSON, saveJSON } from "./jsonStore.js";
import type { LinkedGamertags } from "../types/domainPersistence";

const LINKED_GAMERTAGS_FILE = resolveProjectPath("data", "linked-gamertags.json");

export function loadLinkedGamertags(): LinkedGamertags {
  return loadJSON(LINKED_GAMERTAGS_FILE, {}) as LinkedGamertags;
}

export function saveLinkedGamertags(links: LinkedGamertags): void {
  saveJSON(LINKED_GAMERTAGS_FILE, links);
}

export function linkGamertag(discordUserId: string, gamertag: string): void {
  const links = loadLinkedGamertags();

  links[discordUserId] = gamertag.trim();

  saveLinkedGamertags(links);
}

export function unlinkGamertag(discordUserId: string): void {
  const links = loadLinkedGamertags();

  delete links[discordUserId];

  saveLinkedGamertags(links);
}

export function getGamertagByDiscordUserId(discordUserId: string): string | null {
  const links = loadLinkedGamertags();

  return links[discordUserId] ?? null;
}

export function findGamertagOwner(links: LinkedGamertags, gamertag: string): string | null {
  const trimmedGamertag = gamertag.trim();

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

export function getDiscordUserIdByGamertag(gamertag: string): string | null {
  const links = loadLinkedGamertags();

  return findGamertagOwner(links, gamertag);
}
