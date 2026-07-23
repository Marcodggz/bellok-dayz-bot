import { createRequire } from "node:module";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const require = createRequire(import.meta.url);

const pollerPath = require.resolve("../../../src/features/polling/admFilePoller.js");
const nitradoClientPath = require.resolve("../../../src/api/nitradoClient.js");
const stateStorePath = require.resolve("../../../src/storage/stateStore.js");
const fileStateStorePath = require.resolve("../../../src/storage/fileStateStore.js");
const heatStorePath = require.resolve("../../../src/storage/heatStore.js");
const configPath = require.resolve("../../../src/config/config.js");

let ensureLatestAdmSelected;
let readNewLines;
let nitDownload;
let listAdmNames;
let loadState;
let getFileState;
let setFileState;
let loadHeat;
let saveHeat;
let consoleSpy;

beforeEach(() => {
  delete require.cache[pollerPath];
  delete require.cache[nitradoClientPath];
  delete require.cache[stateStorePath];
  delete require.cache[fileStateStorePath];
  delete require.cache[heatStorePath];
  delete require.cache[configPath];

  // Suppress rotate console output
  const originalConsoleLog = console.log;
  consoleSpy = vi.spyOn(console, "log").mockImplementation((...args) => {
    const msg = args.join(" ");
    if (!msg.includes("[rotate] New ADM file")) {
      originalConsoleLog(...args);
    }
  });

  // Mock Nitrado client
  nitDownload = vi.fn();
  listAdmNames = vi.fn();

  require.cache[nitradoClientPath] = {
    id: nitradoClientPath,
    filename: nitradoClientPath,
    loaded: true,
    exports: { nitDownload, listAdmNames },
  };

  // Mock state stores
  const mockState = {};
  loadState = vi.fn(() => mockState);

  getFileState = vi.fn((st, filePath) => st[filePath] || { size: 0, carry: "" });
  setFileState = vi.fn((st, filePath, obj) => {
    st[filePath] = obj;
  });

  const mockHeat = { points: [], lastSentCount: 0 };
  loadHeat = vi.fn(() => mockHeat);
  saveHeat = vi.fn();

  require.cache[stateStorePath] = {
    id: stateStorePath,
    filename: stateStorePath,
    loaded: true,
    exports: { loadState },
  };

  require.cache[fileStateStorePath] = {
    id: fileStateStorePath,
    filename: fileStateStorePath,
    loaded: true,
    exports: { getFileState, setFileState },
  };

  require.cache[heatStorePath] = {
    id: heatStorePath,
    filename: heatStorePath,
    loaded: true,
    exports: { loadHeat, saveHeat },
  };

  // Mock config
  require.cache[configPath] = {
    id: configPath,
    filename: configPath,
    loaded: true,
    exports: {
      ADM_DIR: "/logs/adm",
      START_AT_END: false,
      DEBUG: false,
      HEATMAP_RESET_ON_ROTATE: false,
    },
  };

  ({ ensureLatestAdmSelected, readNewLines } = require(pollerPath));
});

afterEach(() => {
  consoleSpy?.mockRestore();
});

describe("admFilePoller", () => {
  describe("ensureLatestAdmSelected", () => {
    test("selects and stores the latest ADM file when none is selected", async () => {
      listAdmNames.mockResolvedValue([
        {
          name: "adm_2026-07-15_12-00-00.adm",
          path: "/logs/adm/adm_2026-07-15_12-00-00.adm",
        },
      ]);
      nitDownload.mockResolvedValue({ buffer: Buffer.from("initial content") });

      const result = await ensureLatestAdmSelected();

      expect(result).toBe("/logs/adm/adm_2026-07-15_12-00-00.adm");
      expect(setFileState).toHaveBeenCalledWith(
        expect.any(Object),
        "/logs/adm/adm_2026-07-15_12-00-00.adm",
        { size: 0, carry: "" }
      );
    });

    test("keeps the current ADM file when it is still the latest", async () => {
      listAdmNames.mockResolvedValue([
        {
          name: "adm_2026-07-15_12-00-00.adm",
          path: "/logs/adm/adm_2026-07-15_12-00-00.adm",
        },
      ]);
      nitDownload.mockResolvedValue({ buffer: Buffer.from("content") });

      await ensureLatestAdmSelected();
      setFileState.mockClear();

      const result = await ensureLatestAdmSelected();

      expect(result).toBe("/logs/adm/adm_2026-07-15_12-00-00.adm");
      expect(setFileState).not.toHaveBeenCalled();
    });

    test("switches to a newer ADM file when rotation occurs", async () => {
      listAdmNames.mockResolvedValueOnce([
        {
          name: "adm_2026-07-15_12-00-00.adm",
          path: "/logs/adm/adm_2026-07-15_12-00-00.adm",
        },
      ]);
      nitDownload.mockResolvedValue({ buffer: Buffer.from("") });

      await ensureLatestAdmSelected();

      listAdmNames.mockResolvedValueOnce([
        {
          name: "adm_2026-07-15_13-00-00.adm",
          path: "/logs/adm/adm_2026-07-15_13-00-00.adm",
        },
        {
          name: "adm_2026-07-15_12-00-00.adm",
          path: "/logs/adm/adm_2026-07-15_12-00-00.adm",
        },
      ]);

      const result = await ensureLatestAdmSelected();

      expect(result).toBe("/logs/adm/adm_2026-07-15_13-00-00.adm");
      expect(setFileState).toHaveBeenCalledWith(
        expect.any(Object),
        "/logs/adm/adm_2026-07-15_13-00-00.adm",
        { size: 0, carry: "" }
      );
    });

    test("returns the current ADM file when the remote list is empty", async () => {
      listAdmNames.mockResolvedValueOnce([
        {
          name: "adm_2026-07-15_12-00-00.adm",
          path: "/logs/adm/adm_2026-07-15_12-00-00.adm",
        },
      ]);
      nitDownload.mockResolvedValue({ buffer: Buffer.from("") });

      await ensureLatestAdmSelected();

      listAdmNames.mockResolvedValueOnce([]);

      const result = await ensureLatestAdmSelected();

      expect(result).toBe("/logs/adm/adm_2026-07-15_12-00-00.adm");
    });

    test("returns null when no current file exists and the remote list is empty", async () => {
      listAdmNames.mockResolvedValue([]);

      const result = await ensureLatestAdmSelected();

      expect(result).toBeNull();
    });
  });

  describe("readNewLines", () => {
    test("returns only content after the stored byte offset", async () => {
      const state = {
        "/logs/file.adm": { size: 12, carry: "" },
      };
      loadState.mockReturnValue(state);
      getFileState.mockImplementation((st, fp) => st[fp] || { size: 0, carry: "" });
      nitDownload.mockResolvedValue({
        buffer: Buffer.from("old content\nnew line 1\nnew line 2\n"),
      });

      const lines = await readNewLines("/logs/file.adm");

      expect(lines).toEqual(["new line 1", "new line 2"]);
    });

    test("updates the stored byte offset after reading", async () => {
      const state = {};
      loadState.mockReturnValue(state);
      getFileState.mockImplementation((st, fp) => st[fp] || { size: 0, carry: "" });
      nitDownload.mockResolvedValue({
        buffer: Buffer.from("line 1\nline 2\n"),
      });

      await readNewLines("/logs/file.adm");

      expect(setFileState).toHaveBeenCalledWith(
        state,
        "/logs/file.adm",
        expect.objectContaining({ size: 14 })
      );
    });

    test("resets the offset when the remote file becomes smaller", async () => {
      const state = {
        "/logs/file.adm": { size: 100, carry: "" },
      };
      loadState.mockReturnValue(state);
      getFileState.mockImplementation((st, fp) => st[fp] || { size: 0, carry: "" });
      nitDownload.mockResolvedValue({
        buffer: Buffer.from("new start\n"),
      });

      const lines = await readNewLines("/logs/file.adm");

      expect(lines).toEqual(["new start"]);
      expect(setFileState).toHaveBeenCalledWith(
        state,
        "/logs/file.adm",
        expect.objectContaining({ size: 10 })
      );
    });

    test("returns an empty array when no new content exists", async () => {
      const state = {
        "/logs/file.adm": { size: 20, carry: "" },
      };
      loadState.mockReturnValue(state);
      getFileState.mockImplementation((st, fp) => st[fp] || { size: 0, carry: "" });
      nitDownload.mockResolvedValue({
        buffer: Buffer.from("12345678901234567890"),
      });

      const lines = await readNewLines("/logs/file.adm");

      expect(lines).toEqual([]);
    });

    test("reassembles an ADM line split across consecutive downloads", async () => {
      const partialLine =
        '14:23:45 | Player "Killer" (id=1 pos=<100, 100, 100>) killed Player "Vic';
      const completedLine = partialLine + 'tim" (id=2 pos=<200, 200, 200>) with M4A1';

      const state = {
        "/logs/file.adm": {
          size: 0,
          carry: "",
        },
      };

      loadState.mockReturnValue(state);
      getFileState.mockImplementation((st, fp) => st[fp] || { size: 0, carry: "" });

      nitDownload
        .mockResolvedValueOnce({
          buffer: Buffer.from(partialLine),
        })
        .mockResolvedValueOnce({
          buffer: Buffer.from(`${completedLine}\n`),
        });

      const firstRead = await readNewLines("/logs/file.adm");

      expect(firstRead).toEqual([]);
      expect(state["/logs/file.adm"]).toEqual({
        size: Buffer.byteLength(partialLine),
        carry: partialLine,
      });

      const secondRead = await readNewLines("/logs/file.adm");

      expect(secondRead).toEqual([completedLine]);
      expect(state["/logs/file.adm"]).toEqual({
        size: Buffer.byteLength(`${completedLine}\n`),
        carry: "",
      });
    });

    test("splits downloaded content into non-empty lines correctly", async () => {
      const state = {};
      loadState.mockReturnValue(state);
      getFileState.mockImplementation((st, fp) => st[fp] || { size: 0, carry: "" });
      nitDownload.mockResolvedValue({
        buffer: Buffer.from("line 1\n\nline 2\nline 3\n"),
      });

      const lines = await readNewLines("/logs/file.adm");

      expect(lines).toEqual(["line 1", "line 2", "line 3"]);
    });
  });
});
