import { describe, it, expect } from "vitest";
import {
  arenaLargeBayCapacity,
  ARENA_FLOOR_UPGRADE_IDS,
} from "./arena-bay";

const [B1, B2] = ARENA_FLOOR_UPGRADE_IDS;

describe("arenaLargeBayCapacity", () => {
  it("is 1 with only the ground floor (no basements installed)", () => {
    expect(arenaLargeBayCapacity([])).toBe(1);
  });
  it("is 2 with one basement floor", () => {
    expect(arenaLargeBayCapacity([B1])).toBe(2);
  });
  it("is 3 with both basement floors", () => {
    expect(arenaLargeBayCapacity([B1, B2])).toBe(3);
  });
  it("ignores unrelated installed upgrades", () => {
    expect(arenaLargeBayCapacity(["arena-workshop-quarters", B2])).toBe(2);
  });
});
