import { describe, expect, test } from "vitest";

import { buildLinkSuccessMessage } from "../../../src/features/commands/linkCommands.ts";

describe("linkCommands", () => {
  test("builds a successful link message without mentioning statistics", () => {
    const message = buildLinkSuccessMessage("LeFleur0");

    expect(message).toBe("✅ Successfully linked your account to gamertag **LeFleur0**");
    expect(message).not.toContain("statistics");
  });
});
