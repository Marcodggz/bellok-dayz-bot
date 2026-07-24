// Map ranks to badge images

import fs from "node:fs";
import { resolveProjectPath } from "../config/projectPaths";

const RANK_BADGE_MAP: Record<string, string> = {
  Private: "private.png",
  "Private First Class": "private-first-class.png",
  "Lance Corporal": "lance-corporal.png",
  Corporal: "corporal.png",
  Specialist: "specialist.png",
};

export function getRankBadgePath(rank: string): string | null {
  const badgeFilename = RANK_BADGE_MAP[rank];

  if (!badgeFilename) {
    return null;
  }

  const badgePath = resolveProjectPath("src", "assets", "ranks", badgeFilename);

  try {
    if (fs.existsSync(badgePath)) {
      return badgePath;
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    console.error(`[rankBadges] Error checking badge path: ${message}`);
  }

  return null;
}
