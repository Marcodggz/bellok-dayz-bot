import { describe, expect, test } from "vitest";
import { parseNonPvpDeath } from "../../src/parsers/nonPvpDeathParser.ts";

describe("nonPvpDeathParser", () => {
  test("parses a confirmed zombie death using the ZmbM_ prefix", () => {
    const line =
      '13:16:41 | Player "LeFleur0" (DEAD) (id=test pos=<1984.7, 7696.6, 178.6>) killed by ZmbM_HeavyIndustryWorker';

    expect(parseNonPvpDeath(line)).toEqual({
      type: "non-pvp-death",
      victim: "LeFleur0",
      cause: "zombie",
      entity: "ZmbM_HeavyIndustryWorker",
      t: "13:16:41",
      line,
      victimPosition: {
        x: 1984.7,
        y: 7696.6,
        z: 178.6,
      },
    });
  });

  test("parses a confirmed wolf death using the Animal_CanisLupus prefix", () => {
    const line =
      '13:42:08 | Player "LeFleur0" (DEAD) (id=test pos=<4416.8, 3935.6, 327.1>) killed by Animal_CanisLupus_White';

    const result = parseNonPvpDeath(line);

    expect(result?.cause).toBe("wolf");
    expect(result?.entity).toBe("Animal_CanisLupus_White");
    expect(result?.victim).toBe("LeFleur0");
  });

  test("parses a confirmed bear death", () => {
    const line =
      '19:09:56 | Player "BL6CKx" (DEAD) (id=test pos=<1545.5, 7429.6, 182.6>) killed by Animal_UrsusArctos';

    const result = parseNonPvpDeath(line);

    expect(result?.cause).toBe("bear");
    expect(result?.entity).toBe("Animal_UrsusArctos");
    expect(result?.victim).toBe("BL6CKx");
  });

  test("parses a confirmed general death from died. Stats", () => {
    const line =
      '13:20:52 | Player "LeFleur0" (DEAD) (id=test pos=<1169.6, 7470.9, 180.7>) died. Stats> Water: 557.416 Energy: 557.416 Bleed sources: 2';

    const result = parseNonPvpDeath(line);

    expect(result?.cause).toBe("general");
    expect(result?.entity).toBeNull();
    expect(result?.victim).toBe("LeFleur0");
  });

  test("does not treat a non-fatal bear hit as a death", () => {
    const line =
      '18:29:38 | Player "BL6CKx" (id=test pos=<1682.8, 7475.9, 181.2>)[HP: 22.903] hit by Brown Bear into Torso(38) for 7.5 damage (MeleeBear)';

    expect(parseNonPvpDeath(line)).toBeNull();
  });

  test("does not treat a final hit line as the canonical death event", () => {
    const line =
      '19:09:56 | Player "BL6CKx" (DEAD) (id=test pos=<1545.5, 7429.6, 182.6>)[HP: 0] hit by Brown Bear into Torso(39) for 25 damage (MeleeBearShock)';

    expect(parseNonPvpDeath(line)).toBeNull();
  });

  test("does not treat unconsciousness as a death", () => {
    const line = '19:08:10 | Player "BL6CKx" (id=test pos=<1548.4, 7436.0, 182.0>) is unconscious';

    expect(parseNonPvpDeath(line)).toBeNull();
  });

  test("does not treat performed EmoteSuicide as a confirmed death", () => {
    const line =
      '19:27:51 | Player "BL6CKx" (id=test pos=<1205.0, 6919.1, 239.8>) performed EmoteSuicide with FAL';

    expect(parseNonPvpDeath(line)).toBeNull();
  });

  test("does not treat committed suicide as a separate death", () => {
    const line =
      '19:27:56 | Player "BL6CKx" (id=test pos=<1205.0, 6919.1, 239.8>) committed suicide';

    expect(parseNonPvpDeath(line)).toBeNull();
  });

  test("does not treat bled out as a separate death", () => {
    const line =
      '13:20:52 | Player "LeFleur0" (DEAD) (id=test pos=<1169.6, 7470.9, 180.7>) bled out';

    expect(parseNonPvpDeath(line)).toBeNull();
  });

  test("requires the explicit DEAD marker", () => {
    const line =
      '13:16:41 | Player "LeFleur0" (id=test pos=<1984.7, 7696.6, 178.6>) killed by ZmbM_HeavyIndustryWorker';

    expect(parseNonPvpDeath(line)).toBeNull();
  });

  test("does not classify unknown killed by entities", () => {
    const line =
      '13:16:41 | Player "LeFleur0" (DEAD) (id=test pos=<1984.7, 7696.6, 178.6>) killed by Unknown_Entity';

    expect(parseNonPvpDeath(line)).toBeNull();
  });
});
