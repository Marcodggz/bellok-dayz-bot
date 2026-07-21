import { describe, test, expect, beforeEach, vi } from "vitest";

describe("killParser", () => {
  let parser;

  beforeEach(async () => {
    vi.resetModules();
    parser = await import("../../src/parsers/killParser.js");
  });

  describe("parseKill - PvP kills", () => {
    test("parses valid PvP kill with first pattern (killer killed victim)", () => {
      const line =
        '14:23:45 | Player "Survivor1" (id=12345678 pos=<7234.5, 5678.2, 302.1>) killed Player "Victim1" (id=87654321 pos=<7230.1, 5680.5, 301.8>) with M4A1 from 15.2 meters';

      const result = parser.parseKill(line);

      expect(result).not.toBeNull();
      expect(result.type).toBe("pvp");
      expect(result.killer).toBe("Survivor1");
      expect(result.victim).toBe("Victim1");
      expect(result.weapon).toBe("M4A1");
      expect(result.t).toBe("14:23:45");
      expect(result.line).toBe(line);
    });

    test("parses valid PvP kill with second pattern (victim killed by killer)", () => {
      const line =
        '14:30:01 | Player "Victim2" (id=66554433 pos=<12340.5, 3210.9, 220.4>) killed by Player "Ambusher" (id=33221100 pos=<12350.2, 3215.7, 221.1>) with SKS from 12.5 meters';

      const result = parser.parseKill(line);

      expect(result).not.toBeNull();
      expect(result.type).toBe("pvp");
      expect(result.killer).toBe("Ambusher");
      expect(result.victim).toBe("Victim2");
      expect(result.weapon).toBe("SKS");
      expect(result.t).toBe("14:30:01");
    });

    test("extracts killer and victim names correctly", () => {
      const line =
        '14:48:00 | Player "Raider" (id=33445566 pos=<9876.5, 6543.2, 400.1>) killed Player "Defender" (id=22334455 pos=<9870.3, 6540.8, 399.8>) with AKM';

      const result = parser.parseKill(line);

      expect(result.killer).toBe("Raider");
      expect(result.victim).toBe("Defender");
    });

    test("extracts weapon correctly", () => {
      const line =
        '14:25:12 | Player "Sniper99" (id=11223344 pos=<10245.7, 8912.3, 450.2>) killed Player "Runner23" (id=99887766 pos=<10180.2, 8905.1, 448.9>) with Mosin from 65.8 meters';

      const result = parser.parseKill(line);

      expect(result.weapon).toBe("Mosin");
    });

    test("extracts distance correctly", () => {
      const line =
        '14:23:45 | Player "Survivor1" (id=12345678 pos=<7234.5, 5678.2, 302.1>) killed Player "Victim1" (id=87654321 pos=<7230.1, 5680.5, 301.8>) with M4A1 from 15.2 meters';

      const result = parser.parseKill(line);

      expect(result.distanceMeters).toBe(15.2);
    });

    test("extracts hit zone correctly", () => {
      const line =
        '14:23:45 | Player "Survivor1" (id=12345678 pos=<7234.5, 5678.2, 302.1>) killed Player "Victim1" (id=87654321 pos=<7230.1, 5680.5, 301.8>) with M4A1 from 15.2 meters (Ammo: 5.56x45mm NATO, Hit: Torso, Damage: 85)';

      const result = parser.parseKill(line);

      expect(result.hitZone).toBe("Torso");
    });

    test("extracts ammo and damage when present", () => {
      const line =
        '14:25:12 | Player "Sniper99" (id=11223344 pos=<10245.7, 8912.3, 450.2>) killed Player "Runner23" (id=99887766 pos=<10180.2, 8905.1, 448.9>) with Mosin from 65.8 meters (Ammo: 7.62x54mmR, Hit: Head, Damage: 110)';

      const result = parser.parseKill(line);

      expect(result.ammo).toBe("7.62x54mmR");
      expect(result.damage).toBe(110);
    });

    test("extracts position coordinates when present", () => {
      const line =
        '14:23:45 | Player "Survivor1" (id=12345678 pos=<7234.5, 5678.2, 302.1>) killed Player "Victim1" (id=87654321 pos=<7230.1, 5680.5, 301.8>) with M4A1 from 15.2 meters';

      const result = parser.parseKill(line);

      expect(result.killerPosition).toEqual({
        x: 7234.5,
        y: 5678.2,
        z: 302.1,
      });
      expect(result.victimPosition).toEqual({
        x: 7230.1,
        y: 5680.5,
        z: 301.8,
      });
    });

    test("handles missing optional metadata without failing", () => {
      const line =
        '14:40:55 | Player "Melee1" (id=22334455 pos=<8765.4, 4321.0, 95.7>) killed Player "Unlucky" (id=11223344 pos=<8763.8, 4322.3, 95.5>) with Shovel';

      const result = parser.parseKill(line);

      expect(result).not.toBeNull();
      expect(result.type).toBe("pvp");
      expect(result.killer).toBe("Melee1");
      expect(result.victim).toBe("Unlucky");
      expect(result.weapon).toBe("Shovel");
      expect(result.distanceMeters).toBeNull();
      expect(result.ammo).toBeNull();
      expect(result.hitZone).toBeNull();
      expect(result.damage).toBeNull();
    });
  });

  describe("parseKill - Explosion kills", () => {
    test("parses valid explosion kill with Grenade", () => {
      const line =
        '14:27:33 | Player "BoomGuy" (id=55443322 pos=<4521.8, 9876.5, 125.3>) killed by Grenade explosion';

      const result = parser.parseKill(line);

      expect(result).not.toBeNull();
      expect(result.type).toBe("explosion");
      expect(result.victim).toBe("BoomGuy");
      expect(result.device).toBe("Grenade explosion");
      expect(result.t).toBe("14:27:33");
    });

    test("parses explosion kill with Landmine", () => {
      const line =
        '14:35:44 | Player "TrapVictim" (id=77665544 pos=<6543.2, 7890.1, 180.6>) killed by Landmine explosion';

      const result = parser.parseKill(line);

      expect(result).not.toBeNull();
      expect(result.type).toBe("explosion");
      expect(result.victim).toBe("TrapVictim");
      expect(result.device).toBe("Landmine explosion");
    });

    test("parses explosion kill with IED", () => {
      const line =
        '14:45:30 | Player "ExplosiveVictim" (id=44556677 pos=<3456.7, 11234.5, 305.2>) killed by IED explosion';

      const result = parser.parseKill(line);

      expect(result).not.toBeNull();
      expect(result.type).toBe("explosion");
      expect(result.victim).toBe("ExplosiveVictim");
      expect(result.device).toBe("IED explosion");
    });

    test("parses explosion kill with Tripwire", () => {
      const line =
        '14:50:15 | Player "Unlucky2" (id=11223344 pos=<5432.1, 8765.4, 150.7>) killed by Tripwire explosion';

      const result = parser.parseKill(line);

      expect(result).not.toBeNull();
      expect(result.type).toBe("explosion");
      expect(result.victim).toBe("Unlucky2");
      expect(result.device).toBe("Tripwire explosion");
    });

    test("extracts victim position for explosion deaths", () => {
      const line =
        '14:27:33 | Player "BoomGuy" (id=55443322 pos=<4521.8, 9876.5, 125.3>) killed by Grenade explosion';

      const result = parser.parseKill(line);

      expect(result.victimPosition).toEqual({
        x: 4521.8,
        y: 9876.5,
        z: 125.3,
      });
    });
  });

  describe("parseKill - Non-kill lines", () => {
    test("returns null for PlayerList log lines", () => {
      const line = "14:32:18 | ##### PlayerList log: 12 players online";

      const result = parser.parseKill(line);

      expect(result).toBeNull();
    });

    test("returns null for player connection lines", () => {
      const line = '14:38:20 | Player "NewPlayer" (id=88776655) is connected (ping: 45ms)';

      const result = parser.parseKill(line);

      expect(result).toBeNull();
    });

    test("returns null for player disconnection lines", () => {
      const line = '14:43:12 | Player "Disconnected" (id=99001122) has been disconnected';

      const result = parser.parseKill(line);

      expect(result).toBeNull();
    });

    test("returns null for completely unrelated lines", () => {
      const line = "Some random log message that is not a kill";

      const result = parser.parseKill(line);

      expect(result).toBeNull();
    });
  });

  describe("helper functions", () => {
    test("cleanPlayerName removes quotes correctly", () => {
      expect(parser.cleanPlayerName('"PlayerName"')).toBe("PlayerName");
      expect(parser.cleanPlayerName("'PlayerName'")).toBe("PlayerName");
      expect(parser.cleanPlayerName('"PlayerName"')).toBe("PlayerName");
    });

    test("extractPosition parses coordinates correctly", () => {
      const result = parser.extractPosition("pos=<7234.5, 5678.2, 302.1>");

      expect(result).toEqual({
        x: 7234.5,
        y: 5678.2,
        z: 302.1,
      });
    });

    test("extractPosition returns null for invalid format", () => {
      expect(parser.extractPosition("invalid")).toBeNull();
      expect(parser.extractPosition("pos=<invalid>")).toBeNull();
    });

    test("extractDistance parses distance correctly", () => {
      expect(parser.extractDistance("from 15.2 meters")).toBe(15.2);
      expect(parser.extractDistance("from 65.8 meters")).toBe(65.8);
    });

    test("extractDistance returns null when not present", () => {
      expect(parser.extractDistance("no distance here")).toBeNull();
    });

    test("shouldIgnore identifies lines to skip", () => {
      expect(parser.shouldIgnore("##### PlayerList log: 12 players online")).toBe(true);
      expect(parser.shouldIgnore('Player "Name" is connected')).toBe(true);
      expect(parser.shouldIgnore('Player "Name" has been disconnected')).toBe(true);
      expect(parser.shouldIgnore("14:23:45 | Player killed Player with M4A1")).toBe(false);
    });

    test("regression test: parses real sample ADM position correctly", () => {
      // Real sample from user's ADM log: pos=<13044.9, 7786.9, 5.6>
      // X=13044.9 (horizontal), Y=7786.9 (horizontal), Z=5.6 (elevation)
      const line =
        '14:23:45 | Player "RealPlayer" (id=12345678 pos=<13044.9, 7786.9, 5.6>) killed Player "TestVictim" (id=87654321 pos=<13050.0, 7790.0, 5.8>) with M4A1 from 6.2 meters';

      const result = parser.parseKill(line);

      expect(result).not.toBeNull();
      expect(result.killerPosition).toEqual({
        x: 13044.9,
        y: 7786.9,
        z: 5.6,
      });
      expect(result.victimPosition).toEqual({
        x: 13050.0,
        y: 7790.0,
        z: 5.8,
      });
    });
  });
});
