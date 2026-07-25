import { describe, expect, test, vi } from "vitest";
import {
  createEventTimeNormalizer,
  parseRawTimeMs,
  processPlayerSessionLine,
} from "../../../src/features/stats/playerSessionProcessor.ts";

describe("playerSessionProcessor", () => {
  test("parses a valid ADM time", () => {
    expect(parseRawTimeMs("14:30:45")).toBe((14 * 3600 + 30 * 60 + 45) * 1000);
  });

  test("normalizes times across midnight", () => {
    const normalize = createEventTimeNormalizer();

    const beforeMidnight = normalize("23:59:50");
    const afterMidnight = normalize("00:00:10");

    expect(afterMidnight - beforeMidnight).toBe(20_000);
  });

  test("processes a player connection line", () => {
    const stats = {};
    const normalize = createEventTimeNormalizer();
    const handlePlayerConnect = vi.fn();
    const handlePlayerDisconnect = vi.fn();

    const result = processPlayerSessionLine(
      '14:38:20 | Player "NewPlayer" (id=88776655) is connected (ping: 45ms)',
      stats,
      normalize,
      handlePlayerConnect,
      handlePlayerDisconnect
    );

    expect(handlePlayerConnect).toHaveBeenCalledWith(
      stats,
      "NewPlayer",
      (14 * 3600 + 38 * 60 + 20) * 1000
    );
    expect(handlePlayerDisconnect).not.toHaveBeenCalled();
    expect(result.type).toBe("connect");
  });

  test("processes real Nitrado Base64 player IDs", () => {
    const stats = {};
    const normalize = createEventTimeNormalizer();
    const handlePlayerConnect = vi.fn();
    const handlePlayerDisconnect = vi.fn();

    processPlayerSessionLine(
      '13:01:36 | Player "Vinnizd" (id=SeEi4QqGgcCayk3puBz2QDwjKr313RD66II4nwzjLks= pos=<11088.6, 9174.6, 184.4>) is connected',
      stats,
      normalize,
      handlePlayerConnect,
      handlePlayerDisconnect
    );

    expect(handlePlayerConnect).toHaveBeenCalledWith(
      stats,
      "Vinnizd",
      (13 * 3600 + 1 * 60 + 36) * 1000
    );
  });

  test("processes a player disconnection line", () => {
    const stats = {};
    const normalize = createEventTimeNormalizer();
    const handlePlayerConnect = vi.fn();
    const handlePlayerDisconnect = vi.fn();

    const result = processPlayerSessionLine(
      '14:43:12 | Player "Disconnected" (id=99001122) has been disconnected',
      stats,
      normalize,
      handlePlayerConnect,
      handlePlayerDisconnect
    );

    expect(handlePlayerDisconnect).toHaveBeenCalledWith(
      stats,
      "Disconnected",
      (14 * 3600 + 43 * 60 + 12) * 1000
    );
    expect(handlePlayerConnect).not.toHaveBeenCalled();
    expect(result.type).toBe("disconnect");
  });
});
