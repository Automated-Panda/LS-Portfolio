import { describe, it, expect } from "vitest";

import {
  isPartitionSlots,
  slotMode,
  partitionSlotLabel,
  slotLabeler,
  flagSections,
  isFlagSubSlot,
  type SlotLayout,
} from "./slot-labels";

// CEO Office Garage Level 1 — a clean partition of 20 into 1A/1B/1C.
const OFFICE: SlotLayout[] = [
  { label: "1A", capacity: 6 },
  { label: "1B", capacity: 7 },
  { label: "1C", capacity: 7 },
];

// Mansion Garage — Podium is gated by an upgrade, so NOT a partition.
const MANSION: SlotLayout[] = [
  { label: "Garage", capacity: 17 },
  { label: "Driveway", capacity: 2 },
  { label: "Podium", capacity: 1, required_upgrade_id: "mansion-podium" },
];

// A Facility weaponized bay — vehicle-bound.
const BAY: SlotLayout[] = [
  { label: "Khanjali", capacity: 1, vehicle_id: "khanjali" },
];

describe("isPartitionSlots", () => {
  it("true for an unconditional partition summing to capacity (CEO office)", () => {
    expect(isPartitionSlots(OFFICE, 20)).toBe(true);
  });
  it("false when a section is gated by an upgrade (mansion podium)", () => {
    expect(isPartitionSlots(MANSION, 20)).toBe(false);
  });
  it("false for vehicle-bound bays", () => {
    expect(isPartitionSlots(BAY, 1)).toBe(false);
  });
  it("false when capacities don't sum to the upgrade capacity", () => {
    expect(isPartitionSlots(OFFICE, 19)).toBe(false);
  });
  it("false for empty / missing sub_slots", () => {
    expect(isPartitionSlots(null, 20)).toBe(false);
    expect(isPartitionSlots([], 0)).toBe(false);
  });
});

describe("slotMode", () => {
  it("classifies each flavour", () => {
    expect(slotMode(null, 20)).toBe("none");
    expect(slotMode(BAY, 1)).toBe("bay");
    expect(slotMode(OFFICE, 20)).toBe("partition");
    expect(slotMode(MANSION, 20)).toBe("flags");
  });
});

describe("partitionSlotLabel", () => {
  it("codes slots by section with a section-local index", () => {
    expect(partitionSlotLabel(OFFICE, 1)).toBe("1A-1");
    expect(partitionSlotLabel(OFFICE, 6)).toBe("1A-6");
    expect(partitionSlotLabel(OFFICE, 7)).toBe("1B-1");
    expect(partitionSlotLabel(OFFICE, 13)).toBe("1B-7");
    expect(partitionSlotLabel(OFFICE, 14)).toBe("1C-1");
    expect(partitionSlotLabel(OFFICE, 20)).toBe("1C-7");
  });
  it("falls back to the bare number out of range", () => {
    expect(partitionSlotLabel(OFFICE, 21)).toBe("21");
  });
});

describe("slotLabeler", () => {
  it("returns coded labels for a partition", () => {
    const fmt = slotLabeler(OFFICE, 20);
    expect(fmt(8)).toBe("1B-2");
  });
  it("returns bare numbers for non-partition areas (mansion, base storage)", () => {
    expect(slotLabeler(MANSION, 20)(8)).toBe("8");
    expect(slotLabeler(null, 10)(3)).toBe("3");
  });
});

describe("flagSections", () => {
  it("drops the bulk section, keeps the display flags (mansion)", () => {
    expect(flagSections(MANSION).map((s) => s.label)).toEqual([
      "Driveway",
      "Podium",
    ]);
  });
  it("empty when there's a single section", () => {
    expect(flagSections([{ label: "Garage", capacity: 20 }])).toEqual([]);
  });
});

describe("isFlagSubSlot", () => {
  it("true for Driveway/Podium, false for the bulk and for null", () => {
    expect(isFlagSubSlot(MANSION, "Driveway")).toBe(true);
    expect(isFlagSubSlot(MANSION, "Podium")).toBe(true);
    expect(isFlagSubSlot(MANSION, "Garage")).toBe(false);
    expect(isFlagSubSlot(MANSION, null)).toBe(false);
  });
});
