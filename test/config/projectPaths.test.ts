import path from "node:path";
import { describe, expect, test } from "vitest";
import {
  PROJECT_ROOT,
  findProjectRoot,
  resolveProjectPath,
} from "../../src/config/projectPaths.ts";

describe("projectPaths", () => {
  test("finds the project root from a source directory", () => {
    const sourceDirectory = path.join(PROJECT_ROOT, "src", "storage");

    expect(findProjectRoot(sourceDirectory)).toBe(PROJECT_ROOT);
  });

  test("finds the project root from a compiled directory", () => {
    const compiledDirectory = path.join(PROJECT_ROOT, "dist", "src", "storage");

    expect(findProjectRoot(compiledDirectory)).toBe(PROJECT_ROOT);
  });

  test("resolves data and asset paths from the project root", () => {
    expect(resolveProjectPath("data", "player-stats.json")).toBe(
      path.join(PROJECT_ROOT, "data", "player-stats.json")
    );

    expect(resolveProjectPath("src", "assets", "ranks", "private.png")).toBe(
      path.join(PROJECT_ROOT, "src", "assets", "ranks", "private.png")
    );
  });
});
