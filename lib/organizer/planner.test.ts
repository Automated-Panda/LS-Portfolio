import { describe, it, expect } from "vitest";
import { generatePlan, type PlannerInput } from "./planner";
import type { ParsedIntent } from "./types";
import type { OwnedVehicleInstance } from "@/lib/queries/my-vehicles";
import type { OwnedPropertyDetail } from "@/lib/queries/my-properties";

function garage(): OwnedPropertyDetail {
  return {
    id: "p1",
    property_id: "eclipse",
    display_name: "Eclipse",
    property_type: "residence",
    subtype: "garage",
    subtype_display: "Garage",
    neighborhood: null,
    image_path: null,
    base_capacity: 10,
    counts_as_garage: true,
    ownership_group: "garage",
    price: null,
    total_upgrades: 0,
    installed_upgrades: 0,
    total_cars: 0,
    upgrades: [],
  };
}

function veh(id: string, vehicle_id: string, cls: string): OwnedVehicleInstance {
  return {
    id,
    vehicle_id,
    display_name: vehicle_id,
    class: cls,
    manufacturer_display: "M",
    image_path: null,
    price: null,
    nickname: null,
    notes: null,
    custom_tags: [],
    is_favourite: false,
    tag_ids: [],
    storage: null,
  };
}

const intent: ParsedIntent = {
  criteria: [
    { description: "", filter: { classes: ["Super"] }, target: { property_id: "p1" } },
  ],
  unmatched_handling: "leave",
};

describe("generatePlan bay-awareness", () => {
  it("never moves a bay-bound vehicle to a normal garage, but moves normal ones", () => {
    const khanjali = veh("k1", "khanjali", "Super"); // would match the filter…
    const banshee = veh("b1", "banshee", "Super"); // …and so does this normal car
    const input: PlannerInput = {
      intent,
      portfolio: { vehicles: [khanjali, banshee], properties: [garage()] },
      manufacturerIdByDisplay: new Map(),
    };

    const result = generatePlan(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const movedIds = result.steps.map((s) => s.owned_vehicle_id);
    expect(movedIds).not.toContain("k1"); // Khanjali left alone
    expect(movedIds).toContain("b1"); // normal car still planned
  });

  it("doesn't fail capacity pre-flight just because of bay-bound vehicles", () => {
    // 1 tiny garage, but lots of bay-bound vehicles — should still succeed.
    const small = { ...garage(), base_capacity: 1 };
    const vehicles = [
      veh("a", "khanjali", "Super"),
      veh("b", "chernobog", "Super"),
      veh("c", "cerberus", "Super"),
      veh("d", "banshee", "Super"),
    ];
    const input: PlannerInput = {
      intent,
      portfolio: { vehicles, properties: [small] },
      manufacturerIdByDisplay: new Map(),
    };
    const result = generatePlan(input);
    expect(result.ok).toBe(true);
  });
});
