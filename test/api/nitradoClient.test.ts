// test/api/nitradoClient.test.mjs
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
describe("nitradoClient", () => {
  let nitradoClient;
  let axiosMock;
  let consoleWarnSpy;

  beforeEach(async () => {
    vi.resetModules();

    vi.doMock("../../src/config/config.js", () => ({
      NIT_API: "https://api.nitrado.net",
      SERVICE_ID: "12345",
      NIT_TOKEN: "test-token",
      ROTATE_CHECK_MS: 60000,
      LIST_COOLDOWN_MS: 120000,
      DEBUG: false,
    }));

    axiosMock = {
      create: vi.fn(() => axiosMock),
      get: vi.fn(),
    };

    vi.doMock("axios", () => ({
      default: axiosMock,
    }));

    // Spy on console.warn to suppress expected test messages
    const originalWarn = console.warn;
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation((...args) => {
      const message = args.join(" ");
      // Suppress expected test messages
      if (message.includes("[download] error:") || message.includes("[list] cooldown")) {
        return;
      }
      // Forward all other warnings
      originalWarn(...args);
    });

    nitradoClient = await import("../../src/api/nitradoClient.ts");
  });

  afterEach(() => {
    vi.useRealTimers();
    consoleWarnSpy?.mockRestore();
  });

  it("builds authenticated Nitrado requests with the configured token", () => {
    expect(axiosMock.create).toHaveBeenCalledWith({
      baseURL: "https://api.nitrado.net",
      headers: { Authorization: "Bearer test-token" },
      timeout: 12000,
    });
  });

  it("listAdmNames() returns normalized ADM file entries", async () => {
    axiosMock.get.mockResolvedValueOnce({
      data: {
        data: {
          entries: [
            {
              type: "file",
              name: "2024_01_15-10_30_00.adm",
              path: "/logs/2024_01_15-10_30_00.adm",
            },
            {
              type: "file",
              name: "2024_01_14-12_00_00.adm",
              path: "/logs/2024_01_14-12_00_00.adm",
            },
          ],
        },
      },
    });

    const result = await nitradoClient.listAdmNames("/logs", true);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      name: "2024_01_15-10_30_00.adm",
      path: "/logs/2024_01_15-10_30_00.adm",
    });
    expect(result[1]).toEqual({
      name: "2024_01_14-12_00_00.adm",
      path: "/logs/2024_01_14-12_00_00.adm",
    });
  });

  it("listAdmNames() filters out non-ADM files", async () => {
    axiosMock.get.mockResolvedValueOnce({
      data: {
        data: {
          entries: [
            { type: "file", name: "2024_01_15-10_30_00.adm" },
            { type: "file", name: "config.xml" },
            { type: "dir", name: "subfolder" },
            { type: "file", name: "2024_01_14-12_00_00.ADM" },
          ],
        },
      },
    });

    const result = await nitradoClient.listAdmNames("/logs", true);

    expect(result).toHaveLength(2);
    expect(result.every((r) => r.name.toLowerCase().endsWith(".adm"))).toBe(true);
  });

  it("nitDownload() returns a Buffer on success", async () => {
    const mockBuffer = Buffer.from("log content here");
    axiosMock.get.mockResolvedValueOnce({
      data: mockBuffer,
    });

    const result = await nitradoClient.nitDownload("/logs/test.adm");

    expect(result.buffer).toBeInstanceOf(Buffer);
    expect(result.buffer.toString("utf8")).toBe("log content here");
    expect(result.error).toBeUndefined();
  });

  it("nitDownload() returns an error result instead of throwing when the request fails", async () => {
    axiosMock.get.mockRejectedValueOnce(new Error("Network error"));

    const result = await nitradoClient.nitDownload("/logs/test.adm");

    expect(result.error).toBe(true);
    expect(result.buffer).toBeUndefined();
  });

  it("rate-limit or busy responses start/extend cooldown", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000000);

    axiosMock.get
      .mockRejectedValueOnce({
        response: { status: 429, data: Buffer.from("Rate limit exceeded") },
      })
      .mockRejectedValueOnce({
        response: { status: 429, data: Buffer.from("Rate limit exceeded") },
      })
      .mockRejectedValueOnce({
        response: { status: 429, data: Buffer.from("Rate limit exceeded") },
      });

    const promise = nitradoClient.listAdmNames("/logs", true);

    // Advance timers to resolve the backoff setTimeout calls
    await vi.runAllTimersAsync();

    const result = await promise;

    expect(result).toEqual([]);

    // Cooldown should now be active
    vi.setSystemTime(1050000);
    axiosMock.get.mockClear();

    await nitradoClient.listAdmNames("/logs", false);

    expect(axiosMock.get).not.toHaveBeenCalled(); // Cooldown prevented call
  });

  it("cooldown prevents unnecessary list requests", async () => {
    vi.useFakeTimers();

    // Load a fresh module instance to reset its internal cache and timestamps.
    vi.resetModules();
    const freshClient = await import("../../src/api/nitradoClient.ts");

    vi.setSystemTime(2000000);

    axiosMock.get.mockResolvedValueOnce({
      data: { data: { entries: [{ type: "file", name: "test.adm" }] } },
    });

    await freshClient.listAdmNames("/logs", false); // force=false triggers the check

    vi.setSystemTime(2050000); // 50s later, within ROTATE_CHECK_MS (60s)
    axiosMock.get.mockClear();

    const result = await freshClient.listAdmNames("/logs", false);

    expect(axiosMock.get).not.toHaveBeenCalled();
    expect(result).toEqual([{ name: "test.adm", path: "/logs/test.adm" }]); // Returns cached normalized data
  });

  it("cooldown expires after the configured duration", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000000);

    nitradoClient.startListCooldown(120000);

    vi.setSystemTime(1000000 + 130000); // 130s later, past cooldown

    axiosMock.get.mockResolvedValueOnce({
      data: { data: { entries: [] } },
    });

    await nitradoClient.listAdmNames("/logs", false);

    expect(axiosMock.get).toHaveBeenCalled();
  });

  it("HTML or invalid responses are handled safely", async () => {
    const htmlResponse = "<!DOCTYPE html><html><body>Error</body></html>";
    axiosMock.get.mockResolvedValueOnce({
      data: Buffer.from(htmlResponse),
    });

    const result = await nitradoClient.nitDownload("/logs/test.adm");

    expect(result.error).toBe(true);
    expect(result.buffer).toBeUndefined();
  });

  it("existing cooldown semantics: starting cooldown while already active extends it but reports it was not newly started", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000000);

    const firstStart = nitradoClient.startListCooldown(60000);
    expect(firstStart).toBe(true); // New cooldown started

    vi.setSystemTime(1010000); // 10s later, still in cooldown

    const secondStart = nitradoClient.startListCooldown(60000);
    expect(secondStart).toBe(false); // Still in existing cooldown, just extended

    vi.setSystemTime(1000000 + 65000); // Past first, but not second

    const thirdStart = nitradoClient.startListCooldown(60000);
    expect(thirdStart).toBe(false); // Extended cooldown is still active
  });
});
