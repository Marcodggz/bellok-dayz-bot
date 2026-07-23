import { createRequire } from "node:module";
import { beforeEach, describe, expect, test, vi } from "vitest";

const require = createRequire(import.meta.url);

const handlerPath = require.resolve("../../../src/features/killfeed/killEventHandler.js");
const deduplicatorPath = require.resolve("../../../src/features/killfeed/killEventDeduplicator.js");
const queuePath = require.resolve("../../../src/features/killfeed/killfeedQueue.js");
const positionTrackerPath = require.resolve("../../../src/features/tracking/positionTracker.js");

let handleKillEvents;
let hasSentBucket;
let queueKillfeedEvent;
let posForVictimFromLine;

beforeEach(() => {
  delete require.cache[handlerPath];
  delete require.cache[deduplicatorPath];
  delete require.cache[queuePath];
  delete require.cache[positionTrackerPath];

  hasSentBucket = vi.fn(() => false);
  queueKillfeedEvent = vi.fn();
  posForVictimFromLine = vi.fn();

  require.cache[deduplicatorPath] = {
    id: deduplicatorPath,
    filename: deduplicatorPath,
    loaded: true,
    exports: { hasSentBucket },
  };

  require.cache[queuePath] = {
    id: queuePath,
    filename: queuePath,
    loaded: true,
    exports: { queueKillfeedEvent },
  };

  require.cache[positionTrackerPath] = {
    id: positionTrackerPath,
    filename: positionTrackerPath,
    loaded: true,
    exports: { posForVictimFromLine },
  };

  ({ handleKillEvents } = require(handlerPath));
});

describe("killEventHandler", () => {
  test("empty groups returns [] and queues nothing", () => {
    const result = handleKillEvents(new Map(), []);

    expect(result).toEqual([]);
    expect(queueKillfeedEvent).not.toHaveBeenCalled();
  });

  test("hasSentBucket() returning true skips the group", () => {
    hasSentBucket.mockReturnValue(true);

    const groups = new Map([
      ["Alice|Bob|weapon", { killer: "Alice", victim: "Bob", weapon: "weapon", t: "12:00:00" }],
    ]);
    const lines = ["12:00:00 | Alice killed Bob with weapon"];

    const result = handleKillEvents(groups, lines);

    expect(result).toEqual([]);
    expect(queueKillfeedEvent).not.toHaveBeenCalled();
  });

  test("a new PvP group queues { kill, line } with its bucket key", () => {
    hasSentBucket.mockReturnValue(false);

    const killEvent = {
      killer: "Alice",
      victim: "Bob",
      weapon: "AKM",
      t: "12:00:00",
      distance: 50,
    };
    const groups = new Map([["Alice|Bob|AKM", killEvent]]);
    const lines = ['12:00:00 | Player "Bob" killed by Alice with AKM from 50m'];

    const result = handleKillEvents(groups, lines);

    expect(queueKillfeedEvent).toHaveBeenCalledTimes(1);
    expect(queueKillfeedEvent).toHaveBeenCalledWith(
      {
        kill: killEvent,
        line: lines[0],
        killerStats: null,
        victimStats: null,
      },
      "Alice|Bob|AKM"
    );
    expect(result).toEqual([]);
  });

  test("does not mark a bucket when no matching ADM line exists", () => {
    const killEvent = {
      type: "pvp",
      killer: "Alice",
      victim: "Bob",
      weapon: "AKM",
      t: "12:00:00",
    };

    handleKillEvents(new Map([["Bob|2160", killEvent]]), ["12:00:01 | unrelated line"]);

    expect(queueKillfeedEvent).not.toHaveBeenCalled();
  });

  test("it selects the matching raw line by event timestamp", () => {
    hasSentBucket.mockReturnValue(false);

    const killEvent = {
      killer: "Charlie",
      victim: "Dave",
      weapon: "M4",
      t: "12:00:02",
      distance: 100,
    };
    const groups = new Map([["Charlie|Dave|M4", killEvent]]);
    const lines = [
      "12:00:00 | Other event",
      '12:00:02 | Player "Dave" killed by Charlie with M4 from 100m',
      "12:00:03 | Another event",
    ];

    handleKillEvents(groups, lines);

    expect(queueKillfeedEvent).toHaveBeenCalledWith(
      {
        kill: killEvent,
        line: lines[1],
        killerStats: null,
        victimStats: null,
      },
      "Charlie|Dave|M4"
    );
  });

  test("updates stats and queues snapshots for the killfeed", () => {
    hasSentBucket.mockReturnValue(false);

    const killEvent = {
      type: "pvp",
      killer: "Alice",
      victim: "Bob",
      weapon: "AKM",
      t: "12:01:00",
    };

    const line = '12:01:00 | Player "Alice" killed Player "Bob" with AKM';

    const stats = {
      Bob: {
        kills: 0,
        deaths: 0,
        headshots: 0,
        kd: 0,
        killStreak: 0,
        score: 0,
        rank: "Private",
        connectedSince: 43_200_000,
        accumulatedAliveMs: 0,
        accumulatedPlayedMs: 0,
        isConnected: true,
        lastTimeAlive: null,
      },
    };

    const normalizedEventTimes = new Map([[line, 43_260_000]]);

    handleKillEvents(new Map([["Alice|Bob|AKM", killEvent]]), [line], stats, normalizedEventTimes);

    expect(stats.Bob.lastTimeAlive).toBe("00H 01M 00S");

    expect(queueKillfeedEvent).toHaveBeenCalledWith(
      {
        kill: killEvent,
        line,
        killerStats: expect.objectContaining({
          kills: 1,
        }),
        victimStats: expect.objectContaining({
          deaths: 1,
          lastTimeAlive: "00H 01M 00S",
        }),
      },
      "Alice|Bob|AKM"
    );
  });

  test("processes connect, death, and respawn in chronological ADM order", () => {
    hasSentBucket.mockReturnValue(false);

    const connectLine =
      '14:45:39 | Player "Vinnizd" (id=test pos=<11344.6, 9897.9, 175.9>) is connected';
    const killLine =
      '14:50:54 | Player "Vinnizd" (DEAD) (id=test pos=<11341, 10046.8, 172.2>) killed by 6-M7 Frag Grenade';
    const respawnLine =
      '14:51:05 | Player "Vinnizd" (id=test pos=<10384.5, 10979.0, 189.8>) is connected';

    const killEvent = {
      type: "explosion",
      victim: "Vinnizd",
      device: "6-M7 Frag Grenade",
      t: "14:50:54",
      line: killLine,
    };

    const stats = {};
    const normalizedEventTimes = new Map();

    const processSessionLine = (line) => {
      const times = new Map([
        [connectLine, 53_139_000],
        [killLine, 53_454_000],
        [respawnLine, 53_465_000],
      ]);

      normalizedEventTimes.set(line, times.get(line));

      if (line === connectLine || line === respawnLine) {
        stats.Vinnizd ??= {
          kills: 0,
          deaths: 0,
          headshots: 0,
          kd: 0,
          killStreak: 0,
          score: 0,
          rank: "Private",
          connectedSince: null,
          accumulatedAliveMs: 0,
          accumulatedPlayedMs: 0,
          isConnected: false,
          lastTimeAlive: null,
        };

        stats.Vinnizd.isConnected = true;
        stats.Vinnizd.connectedSince = times.get(line);
      }
    };

    handleKillEvents(
      new Map([["Vinnizd|explosion", killEvent]]),
      [connectLine, killLine, respawnLine],
      stats,
      normalizedEventTimes,
      processSessionLine
    );

    expect(queueKillfeedEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        victimStats: expect.objectContaining({
          lastTimeAlive: "00H 05M 15S",
        }),
      }),
      "Vinnizd|explosion"
    );

    expect(stats.Vinnizd.connectedSince).toBe(53_465_000);
    expect(stats.Vinnizd.isConnected).toBe(true);
  });

  test("valid finite coordinates are returned", () => {
    hasSentBucket.mockReturnValue(false);
    posForVictimFromLine.mockReturnValue({ x: 1234.5, y: 6789.0 });

    const killEvent = {
      killer: "Eve",
      victim: "Frank",
      weapon: "SVD",
      t: "12:00:03",
      distance: 200,
      line: "the kill event line",
    };
    const groups = new Map([["Eve|Frank|SVD", killEvent]]);
    const lines = ['12:00:03 | Player "Frank" killed by Eve with SVD from 200m'];

    const result = handleKillEvents(groups, lines);

    expect(posForVictimFromLine).toHaveBeenCalledWith("Frank", "the kill event line");
    expect(result).toEqual([{ x: 1234.5, y: 6789.0 }]);
  });

  test("missing, NaN, or infinite coordinates are ignored", () => {
    hasSentBucket.mockReturnValue(false);

    const groups = new Map([
      ["G1|V1|W1", { killer: "G1", victim: "V1", weapon: "W1", t: "12:00:01" }],
      ["G2|V2|W2", { killer: "G2", victim: "V2", weapon: "W2", t: "12:00:02" }],
      ["G3|V3|W3", { killer: "G3", victim: "V3", weapon: "W3", t: "12:00:03" }],
    ]);
    const lines = [
      '12:00:01 | Player "V1" killed by G1',
      '12:00:02 | Player "V2" killed by G2',
      '12:00:03 | Player "V3" killed by G3',
    ];

    posForVictimFromLine
      .mockReturnValueOnce(null)
      .mockReturnValueOnce({ x: NaN, y: 100 })
      .mockReturnValueOnce({ x: Infinity, y: 200 });

    const result = handleKillEvents(groups, lines);

    expect(result).toEqual([]);
  });
});
