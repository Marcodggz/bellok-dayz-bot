import { describe, expect, test } from "vitest";
import linkedGamertagsStore from "../../src/storage/linkedGamertagsStore.js";

const { findGamertagOwner } = linkedGamertagsStore;

describe("findGamertagOwner", () => {
  const links = {
    "discord-user-1": "Bellok",
    "discord-user-2": "Marco",
  };

  test("returns the owner for an exact match", () => {
    expect(findGamertagOwner(links, "Bellok")).toBe("discord-user-1");
  });

  test("returns the owner for a unique case-insensitive match", () => {
    expect(findGamertagOwner(links, "  bellok  ")).toBe(
      "discord-user-1",
    );
  });

  test("returns null when the gamertag is not linked", () => {
    expect(findGamertagOwner(links, "Unknown")).toBeNull();
  });

  test("returns null for an ambiguous case-insensitive match", () => {
    const ambiguousLinks = {
      "discord-user-1": "Bellok",
      "discord-user-2": "BELLOK",
    };

    expect(findGamertagOwner(ambiguousLinks, "bellok")).toBeNull();
  });

  test("returns null for an empty gamertag", () => {
    expect(findGamertagOwner(links, "   ")).toBeNull();
  });
});
