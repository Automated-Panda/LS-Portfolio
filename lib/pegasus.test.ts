import { describe, it, expect } from "vitest";
import { isSummonOnly, needsBayProperty, isUnassignedNagworthy } from "./pegasus";

type V = Parameters<typeof isSummonOnly>[0];
type P = Parameters<typeof isSummonOnly>[1][number];

const veh = (o: Partial<V> & { vehicle_id: string }): V => ({
  tag_ids: [],
  class: "Sports",
  storage: null,
  nested_in: null,
  ...o,
});

const prop = (subtype: string, counts_as_garage = false): P => ({
  subtype,
  counts_as_garage,
});

describe("isSummonOnly", () => {
  it("is true for a broad Pegasus aircraft with no hangar", () => {
    const jet = veh({ vehicle_id: "luxor", tag_ids: ["pegasus"], class: "Plane" });
    expect(isSummonOnly(jet, [])).toBe(true);
  });

  it("is FALSE for a bay-bound weaponized vehicle (handled by needsBayProperty)", () => {
    const khanjali = veh({
      vehicle_id: "khanjali",
      tag_ids: ["pegasus", "military"],
    });
    expect(isSummonOnly(khanjali, [])).toBe(false);
  });

  it("is false once the Pegasus vehicle has a compatible hangar", () => {
    const jet = veh({ vehicle_id: "luxor", tag_ids: ["pegasus"], class: "Plane" });
    expect(isSummonOnly(jet, [prop("hangar", true)])).toBe(false);
  });

  it("keeps a no-storage Pegasus vehicle (Rhino) summon-only even with garages", () => {
    const rhino = veh({ vehicle_id: "rhino", tag_ids: ["pegasus"], class: "Military" });
    // Owns a garage — but a Rhino can't be parked in one, so still summon-only.
    expect(isSummonOnly(rhino, [prop("stand-alone-garage", true)])).toBe(true);
  });

  it("does not flag a summon-only Rhino as needing a home", () => {
    const rhino = veh({ vehicle_id: "rhino", tag_ids: ["pegasus"], class: "Military" });
    expect(isUnassignedNagworthy(rhino, [prop("stand-alone-garage", true)])).toBe(
      false,
    );
  });

  it("a stored summon-only vehicle is no longer summon-only", () => {
    const rhino = veh({
      vehicle_id: "rhino",
      tag_ids: ["pegasus"],
      class: "Military",
      storage: {
        owned_property_id: "op1",
        property_display_name: "Garage",
        property_subtype_display: "Garage",
        assigned_upgrade_id: null,
        upgrade_display_name: null,
        sub_slot: null,
        slot_number: null,
      },
    });
    expect(isSummonOnly(rhino, [])).toBe(false);
  });
});

describe("needsBayProperty", () => {
  it("flags an unstored Khanjali when no Facility is owned", () => {
    const khanjali = veh({ vehicle_id: "khanjali" });
    expect(needsBayProperty(khanjali, [])).toEqual({ label: "Facility" });
  });

  it("flags an unstored Cerberus when no Arena is owned", () => {
    const cerberus = veh({ vehicle_id: "cerberus" });
    expect(needsBayProperty(cerberus, [])).toEqual({ label: "Arena Workshop" });
  });

  it("returns null once the bay property is owned", () => {
    const khanjali = veh({ vehicle_id: "khanjali" });
    expect(needsBayProperty(khanjali, [prop("facility")])).toBeNull();
  });

  it("returns null for a non-bay-bound vehicle", () => {
    const banshee = veh({ vehicle_id: "banshee" });
    expect(needsBayProperty(banshee, [])).toBeNull();
  });

  it("returns null when the bay-bound vehicle is already stored", () => {
    const khanjali = veh({
      vehicle_id: "khanjali",
      storage: {
        owned_property_id: "op1",
        property_display_name: "Facility",
        property_subtype_display: "Facility",
        assigned_upgrade_id: "facility-weaponized-bays",
        upgrade_display_name: "Weaponized Bays",
        sub_slot: "Khanjali",
        slot_number: null,
      },
    });
    expect(needsBayProperty(khanjali, [])).toBeNull();
  });
});
