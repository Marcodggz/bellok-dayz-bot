import { createRequire } from "node:module";
import { beforeEach, describe, expect, test, vi } from "vitest";

const require = createRequire(import.meta.url);

const handlerPath =
  require.resolve("../../../src/features/killfeed/killEventHandler.js");
const deduplicatorPath =
  require.resolve("../../../src/features/killfeed/killEventDeduplicator.js");
const queuePath =
  require.resolve("../../../src/features/killfeed/killfeedQueue.js");
const positionTrackerPath =
  require.resolve("../../../src/features/tracking/positionTracker.js");

let handleKillEvents;
let alreadySentBucket;
let queueKillfeedEvent;
let posForVictimFromLine;

beforeEach(() => {
  delete require.cache[handlerPath];
  delete require.cache[deduplicatorPath];
  delete require.cache[queuePath];
  delete require.cache[positionTrackerPath];

  alreadySentBucket = vi.fn(() => false);
  queueKillfeedEvent = vi.fn();
  posForVictimFromLine = vi.fn();

  require.cache[deduplicatorPath] = {
    id: deduplicatorPath,
    filename: deduplicatorPath,
    loaded: true,
    exports: { alreadySentBucket },
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

  test("alreadySentBucket() returning true skips the group", () => {
    alreadySentBucket.mockReturnValue(true);

    const groups = new Map([
      [
        "Alice|Bob|weapon",
        { killer: "Alice", victim: "Bob", weapon: "weapon", t: "12:00:00" },
      ],
    ]);
    const lines = ["12:00:00 | Alice killed Bob with weapon"];

    const result = handleKillEvents(groups, lines);

    expect(result).toEqual([]);
    expect(queueKillfeedEvent).not.toHaveBeenCalled();
  });

  test("a new PvP group queues { kill, line } with its bucket key", () => {
    alreadySentBucket.mockReturnValue(false);

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
      },
      "Alice|Bob|AKM",
    );
    expect(result).toEqual([]);
  });

  test("it selects the matching raw line by event timestamp", () => {
    alreadySentBucket.mockReturnValue(false);

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
      },
      "Charlie|Dave|M4",
    );
  });

  test("valid finite coordinates are returned", () => {
    alreadySentBucket.mockReturnValue(false);
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
    const lines = [
      '12:00:03 | Player "Frank" killed by Eve with SVD from 200m',
    ];

    const result = handleKillEvents(groups, lines);

    expect(posForVictimFromLine).toHaveBeenCalledWith(
      "Frank",
      "the kill event line",
    );
    expect(result).toEqual([{ x: 1234.5, y: 6789.0 }]);
  });

  test("missing, NaN, or infinite coordinates are ignored", () => {
    alreadySentBucket.mockReturnValue(false);

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
