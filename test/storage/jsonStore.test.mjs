import { afterEach, describe, expect, test, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadJSON, saveJSON } from "../../src/storage/jsonStore.ts";

const temporaryDirectories = [];

function createTemporaryDirectory() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "bellok-json-store-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(() => {
  vi.restoreAllMocks();

  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("jsonStore", () => {
  test("writes JSON atomically and removes the temporary file", () => {
    const directory = createTemporaryDirectory();
    const file = path.join(directory, "state.json");
    const data = {
      points: [{ x: 100, y: 200 }],
      messageId: "123",
    };

    saveJSON(file, data);

    expect(JSON.parse(fs.readFileSync(file, "utf8"))).toEqual(data);
    expect(fs.existsSync(`${file}.tmp`)).toBe(false);
  });

  test("supports formatted JSON without changing the stored data", () => {
    const directory = createTemporaryDirectory();
    const file = path.join(directory, "mock-stats.json");
    const data = {
      PlayerOne: {
        kills: 2,
      },
    };

    saveJSON(file, data, 2);

    expect(fs.readFileSync(file, "utf8")).toBe(JSON.stringify(data, null, 2));
    expect(loadJSON(file, {})).toEqual(data);
    expect(fs.existsSync(`${file}.tmp`)).toBe(false);
  });

  test("cleans the temporary file and preserves the final file when writing fails", () => {
    const directory = createTemporaryDirectory();
    const file = path.join(directory, "state.json");
    const temporaryFile = `${file}.tmp`;
    const originalData = { version: 1 };

    fs.writeFileSync(file, JSON.stringify(originalData));

    const originalWriteFileSync = fs.writeFileSync.bind(fs);

    vi.spyOn(fs, "writeFileSync").mockImplementation((target, data, options) => {
      if (target === temporaryFile) {
        originalWriteFileSync(target, data, options);
        throw new Error("write failed");
      }

      return originalWriteFileSync(target, data, options);
    });

    expect(() => saveJSON(file, { version: 2 })).toThrow("write failed");
    expect(JSON.parse(fs.readFileSync(file, "utf8"))).toEqual(originalData);
    expect(fs.existsSync(temporaryFile)).toBe(false);
  });

  test("cleans the temporary file and preserves the final file when rename fails", () => {
    const directory = createTemporaryDirectory();
    const file = path.join(directory, "state.json");
    const temporaryFile = `${file}.tmp`;
    const originalData = { version: 1 };

    fs.writeFileSync(file, JSON.stringify(originalData));

    vi.spyOn(fs, "renameSync").mockImplementation(() => {
      throw new Error("rename failed");
    });

    expect(() => saveJSON(file, { version: 2 })).toThrow("rename failed");
    expect(JSON.parse(fs.readFileSync(file, "utf8"))).toEqual(originalData);
    expect(fs.existsSync(temporaryFile)).toBe(false);
  });
});
