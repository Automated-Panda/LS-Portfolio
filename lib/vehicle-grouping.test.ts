import { describe, it, expect } from "vitest";
import { groupInstances, type GroupBy } from "./vehicle-grouping";
import type { OwnedVehicleInstance } from "@/lib/queries/my-vehicles";

let seq = 0;
function inst(
  o: Partial<OwnedVehicleInstance> & {
    property?: string | null;
    slot?: number | null;
    upgradeId?: string | null;
    upgradeName?: string | null;
  } = {},
): OwnedVehicleInstance {
  const {
    property = null,
    slot = null,
    upgradeId = null,
    upgradeName = null,
    ...rest
  } = o;
  seq += 1;
  return {
    id: `i${seq}`,
    vehicle_id: rest.vehicle_id ?? `v${seq}`,
    display_name: rest.display_name ?? `Car ${seq}`,
    class: rest.class ?? "Sports",
    manufacturer_display: rest.manufacturer_display ?? "Pegassi",
    image_path: null,
    price: null,
    nickname: rest.nickname ?? null,
    notes: null,
    custom_tags: [],
    is_favourite: false,
    tag_ids: [],
    storage: property
      ? {
          owned_property_id: `op-${property}`,
          property_display_name: property,
          property_subtype_display: "Garage",
          assigned_upgrade_id: upgradeId,
          upgrade_display_name: upgradeName,
          sub_slot: null,
          slot_number: slot,
        }
      : null,
    nested_in: null,
  };
}

const labels = (gs: { label: string }[]) => gs.map((g) => g.label);
const ids = (items: { id: string }[]) => items.map((i) => i.id);

describe("groupInstances none", () => {
  it("returns a single group preserving order", () => {
    const a = inst();
    const b = inst();
    const gs = groupInstances([a, b], "none");
    expect(gs).toHaveLength(1);
    expect(ids(gs[0].items)).toEqual([a.id, b.id]);
  });
});

describe("groupInstances garage", () => {
  it("groups by property and sinks Not stored last", () => {
    const eclipse = inst({ property: "Eclipse Towers", slot: 1 });
    const none = inst({ property: null });
    const arcadia = inst({ property: "Arcadius", slot: 1 });
    const gs = groupInstances([eclipse, none, arcadia], "garage");
    expect(labels(gs)).toEqual(["Arcadius", "Eclipse Towers", "Not stored"]);
  });

  it("orders cars within a garage by slot, unplaced last", () => {
    const s3 = inst({ property: "G", slot: 3 });
    const unplaced = inst({ property: "G", slot: null });
    const s1 = inst({ property: "G", slot: 1 });
    const gs = groupInstances([s3, unplaced, s1], "garage");
    expect(ids(gs[0].items)).toEqual([s1.id, s3.id, unplaced.id]);
  });

  it("splits a multi-floor garage into per-floor subgroups (numeric order)", () => {
    const f2 = inst({
      property: "Vinewood",
      upgradeId: "vw-2",
      upgradeName: "Floor 2",
      slot: 1,
    });
    const f10 = inst({
      property: "Vinewood",
      upgradeId: "vw-10",
      upgradeName: "Floor 10",
      slot: 1,
    });
    const f1 = inst({
      property: "Vinewood",
      upgradeId: "vw-1",
      upgradeName: "Floor 1",
      slot: 1,
    });
    const gs = groupInstances([f2, f10, f1], "garage");
    expect(gs).toHaveLength(1);
    expect(gs[0].items).toHaveLength(0); // flattened into subgroups
    expect(gs[0].subgroups?.map((s) => s.label)).toEqual([
      "Floor 1",
      "Floor 2",
      "Floor 10",
    ]);
  });

  it("keeps a single-area garage flat (no subgroups)", () => {
    const a = inst({ property: "Arcadius", upgradeId: "g", upgradeName: "Garage", slot: 1 });
    const b = inst({ property: "Arcadius", upgradeId: "g", upgradeName: "Garage", slot: 2 });
    const gs = groupInstances([a, b], "garage");
    expect(gs[0].subgroups).toBeUndefined();
    expect(gs[0].items).toHaveLength(2);
  });
});

describe("groupInstances manufacturer / class", () => {
  it("groups by manufacturer alphabetically", () => {
    const gs = groupInstances(
      [
        inst({ manufacturer_display: "Vapid" }),
        inst({ manufacturer_display: "Annis" }),
      ],
      "manufacturer",
    );
    expect(labels(gs)).toEqual(["Annis", "Vapid"]);
  });

  it("puts blank manufacturer last", () => {
    const gs = groupInstances(
      [inst({ manufacturer_display: "" }), inst({ manufacturer_display: "Annis" })],
      "manufacturer",
    );
    expect(labels(gs)).toEqual(["Annis", "—"]);
  });

  it("groups by class", () => {
    const gs = groupInstances(
      [inst({ class: "Super" }), inst({ class: "Motorcycle" })],
      "class" as GroupBy,
    );
    expect(labels(gs)).toEqual(["Motorcycle", "Super"]);
  });
});

describe("groupInstances model", () => {
  it("clusters identical models, biggest first", () => {
    const banshee1 = inst({ vehicle_id: "banshee", display_name: "Banshee" });
    const banshee2 = inst({ vehicle_id: "banshee", display_name: "Banshee" });
    const zentorno = inst({ vehicle_id: "zentorno", display_name: "Zentorno" });
    const banshee3 = inst({ vehicle_id: "banshee", display_name: "Banshee" });
    const gs = groupInstances([banshee1, zentorno, banshee2, banshee3], "model");
    expect(labels(gs)).toEqual(["Banshee", "Zentorno"]);
    expect(gs[0].items).toHaveLength(3);
  });
});
