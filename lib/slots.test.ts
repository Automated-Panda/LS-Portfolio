import { describe, it, expect } from "vitest";
import {
  takenSlots,
  nextFreeSlot,
  clampSlot,
  isValidSlot,
  occupantAtSlot,
  planAutoArrange,
  type SlotOccupant,
} from "./slots";

const occ = (id: string, slot_number: number | null): SlotOccupant => ({
  id,
  slot_number,
});

describe("takenSlots", () => {
  it("collects placed slot numbers and ignores unplaced", () => {
    const t = takenSlots([occ("a", 1), occ("b", null), occ("c", 3)]);
    expect([...t].sort()).toEqual([1, 3]);
  });
});

describe("nextFreeSlot", () => {
  it("returns the lowest free slot", () => {
    expect(nextFreeSlot([occ("a", 1), occ("b", 3)], 10)).toBe(2);
  });
  it("skips to first gap when 1 is taken", () => {
    expect(nextFreeSlot([occ("a", 1), occ("b", 2)], 10)).toBe(3);
  });
  it("returns 1 when empty", () => {
    expect(nextFreeSlot([], 10)).toBe(1);
  });
  it("returns null when full", () => {
    expect(nextFreeSlot([occ("a", 1), occ("b", 2)], 2)).toBeNull();
  });
  it("ignores unplaced cars when finding the next slot", () => {
    expect(nextFreeSlot([occ("a", null), occ("b", null)], 2)).toBe(1);
  });
});

describe("clampSlot", () => {
  it("clamps below 1 up to 1", () => {
    expect(clampSlot(0, 10)).toBe(1);
    expect(clampSlot(-5, 10)).toBe(1);
  });
  it("clamps above capacity down to capacity", () => {
    expect(clampSlot(99, 10)).toBe(10);
  });
  it("floors fractional input", () => {
    expect(clampSlot(3.9, 10)).toBe(3);
  });
  it("falls back to 1 for NaN", () => {
    expect(clampSlot(Number.NaN, 10)).toBe(1);
  });
});

describe("isValidSlot", () => {
  it("accepts in-range integers", () => {
    expect(isValidSlot(1, 10)).toBe(true);
    expect(isValidSlot(10, 10)).toBe(true);
  });
  it("rejects out-of-range and non-integers", () => {
    expect(isValidSlot(0, 10)).toBe(false);
    expect(isValidSlot(11, 10)).toBe(false);
    expect(isValidSlot(2.5, 10)).toBe(false);
  });
});

describe("occupantAtSlot", () => {
  const cars = [occ("a", 1), occ("b", 2), occ("c", null)];
  it("finds the car in a slot", () => {
    expect(occupantAtSlot(cars, 2)?.id).toBe("b");
  });
  it("returns null for an empty slot", () => {
    expect(occupantAtSlot(cars, 5)).toBeNull();
  });
  it("excludes self so re-confirming own slot is not a conflict", () => {
    expect(occupantAtSlot(cars, 1, "a")).toBeNull();
  });
});

describe("planAutoArrange", () => {
  it("numbers cars 1..N in order", () => {
    expect(planAutoArrange([{ id: "a" }, { id: "b" }, { id: "c" }], 10)).toEqual([
      { id: "a", slot: 1 },
      { id: "b", slot: 2 },
      { id: "c", slot: 3 },
    ]);
  });
  it("leaves overflow cars unplaced when over capacity", () => {
    expect(planAutoArrange([{ id: "a" }, { id: "b" }, { id: "c" }], 2)).toEqual([
      { id: "a", slot: 1 },
      { id: "b", slot: 2 },
      { id: "c", slot: null },
    ]);
  });
});
