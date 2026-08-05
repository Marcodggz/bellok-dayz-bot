import { describe, expect, test } from "vitest";

import * as config from "../../src/config/config.ts";
import { getEnvironmentError } from "../../src/runtime/botRuntime.ts";

function createConfig(overrides: Partial<typeof config> = {}): typeof config {
  return {
    ...config,
    NIT_TOKEN: "nitrado-token",
    SERVICE_ID: "service-id",
    CHANNEL_ID: "channel-id",
    DISCORD_TOKEN: "discord-token",
    ADM_DIR: "/logs",
    ...overrides,
  };
}

describe("getEnvironmentError", () => {
  test("accepts a complete runtime configuration", () => {
    expect(getEnvironmentError("run", createConfig())).toBeNull();
  });

  test("reports missing required service and Discord values", () => {
    expect(
      getEnvironmentError(
        "run",
        createConfig({
          NIT_TOKEN: undefined,
        })
      )
    ).toBe(
      "Missing .env variables: NITRADO_TOKEN, NITRADO_SERVICE_ID, DISCORD_CHANNEL_ID, DISCORD_TOKEN"
    );
  });

  test("requires the ADM directory in normal runtime mode", () => {
    expect(
      getEnvironmentError(
        "run",
        createConfig({
          ADM_DIR: "",
        })
      )
    ).toBe("Missing NITRADO_ADM_DIR (should point to /noftp/.../dayzps/config)");
  });

  test("allows diagnostic modes without an ADM directory", () => {
    expect(
      getEnvironmentError(
        "discord-test",
        createConfig({
          ADM_DIR: "",
        })
      )
    ).toBeNull();
  });
});
