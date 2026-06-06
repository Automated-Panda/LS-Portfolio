// Hand-crafted (portfolio, intent) tuples with expected plan summaries.
// Run via `tsx lib/organizer/__samples__/run.ts` to eyeball-verify the
// planner's output against expectations.

import type { OwnedVehicleInstance } from "@/lib/queries/my-vehicles";
import type { OwnedPropertyDetail } from "@/lib/queries/my-properties";
import type { ParsedIntent } from "../types";

export type Sample = {
  name: string;
  description: string;
  vehicles: OwnedVehicleInstance[];
  properties: OwnedPropertyDetail[];
  intent: ParsedIntent;
  expect: {
    ok: boolean;
    carsMoved?: number;
    carsUnassigned?: number;
    totalSteps?: number;
  };
};

// Minimal vehicle factory.
function v(
  id: string,
  display_name: string,
  className: string,
  tags: string[],
  storage: { property: string; upgrade?: string } | null,
): OwnedVehicleInstance {
  return {
    id,
    vehicle_id: `vid-${id}`,
    display_name,
    class: className,
    manufacturer_display: "Mock",
    image_path: null,
    price: null,
    nickname: null,
    notes: null,
    custom_tags: [],
    is_favourite: false,
    tag_ids: tags,
    storage: storage
      ? {
          owned_property_id: storage.property,
          property_display_name: storage.property,
          property_subtype_display: "Mock",
          assigned_upgrade_id: storage.upgrade ?? null,
          upgrade_display_name: storage.upgrade ?? null,
          sub_slot: null,
          slot_number: null,
        }
      : null,
  };
}

function p(
  id: string,
  display_name: string,
  baseCapacity: number,
  upgrades: Array<{ id: string; capacity: number; installed: boolean }>,
): OwnedPropertyDetail {
  return {
    id,
    property_id: `pid-${id}`,
    display_name,
    subtype: "mock",
    subtype_display: "Mock",
    neighborhood: null,
    image_path: null,
    base_capacity: baseCapacity,
    counts_as_garage: true,
    property_type: "residence",
    ownership_group: id,
    price: null,
    total_upgrades: upgrades.length,
    installed_upgrades: upgrades.filter((u) => u.installed).length,
    total_cars: 0,
    upgrades: upgrades.map((u, i) => ({
      id: u.id,
      display_name: u.id,
      capacity: u.capacity,
      required_upgrade_id: null,
      sort_order: i,
      is_installed: u.installed,
      cars_here: 0,
      price: null,
      sub_slots: null,
      mutex_group: null,
      included_on_purchase: false,
    })),
  };
}

export const SAMPLES: Sample[] = [
  {
    name: "simple-fit",
    description: "Move 2 drift cars into empty Mission Row L1.",
    vehicles: [
      v("car1", "Banshee", "Sports", ["drift"], { property: "la-mesa", upgrade: "la-mesa-l1" }),
      v("car2", "Sultan", "Sports", ["drift"], { property: "la-mesa", upgrade: "la-mesa-l1" }),
    ],
    properties: [
      p("la-mesa", "La Mesa", 0, [{ id: "la-mesa-l1", capacity: 10, installed: true }]),
      p("mission-row", "Mission Row", 0, [{ id: "mr-l1", capacity: 10, installed: true }]),
    ],
    intent: {
      criteria: [{ description: "drift cars", filter: { tags: ["drift"] }, target: { property_id: "mission-row" } }],
      unmatched_handling: "leave",
    },
    expect: { ok: true, carsMoved: 2, carsUnassigned: 0, totalSteps: 2 },
  },
  {
    name: "displacement",
    description: "Target full; one non-matching car displaced.",
    vehicles: [
      v("drift1", "Banshee", "Sports", ["drift"], { property: "la-mesa", upgrade: "la-l1" }),
      v("drift2", "Sultan", "Sports", ["drift"], { property: "la-mesa", upgrade: "la-l1" }),
      v("filler1", "Adder", "Super", [], { property: "mission-row", upgrade: "mr-l1" }),
      v("filler2", "Zentorno", "Super", [], { property: "mission-row", upgrade: "mr-l1" }),
    ],
    properties: [
      p("la-mesa", "La Mesa", 0, [{ id: "la-l1", capacity: 10, installed: true }]),
      p("mission-row", "Mission Row", 0, [{ id: "mr-l1", capacity: 2, installed: true }]),
    ],
    intent: {
      criteria: [{ description: "drift cars", filter: { tags: ["drift"] }, target: { property_id: "mission-row" } }],
      unmatched_handling: "leave",
    },
    expect: { ok: true, carsMoved: 2, carsUnassigned: 0, totalSteps: 4 }, // 2 displacements + 2 moves
  },
  {
    name: "compound",
    description: "Compound query: drift cars to Mission Row, supers to Eclipse.",
    vehicles: [
      v("d1", "Banshee", "Sports", ["drift"], { property: "la-mesa", upgrade: "la-l1" }),
      v("d2", "Sultan", "Sports", ["drift"], { property: "la-mesa", upgrade: "la-l1" }),
      v("s1", "Zentorno", "Super", [], { property: "la-mesa", upgrade: "la-l1" }),
      v("s2", "Adder", "Super", [], { property: "la-mesa", upgrade: "la-l1" }),
    ],
    properties: [
      p("la-mesa", "La Mesa", 0, [{ id: "la-l1", capacity: 10, installed: true }]),
      p("mission-row", "Mission Row", 0, [{ id: "mr-l1", capacity: 5, installed: true }]),
      p("eclipse", "Eclipse Apt 30", 10, []),
    ],
    intent: {
      criteria: [
        { description: "drift cars", filter: { tags: ["drift"] }, target: { property_id: "mission-row" } },
        { description: "supers", filter: { classes: ["Super"] }, target: { property_id: "eclipse" } },
      ],
      unmatched_handling: "leave",
    },
    expect: { ok: true, carsMoved: 4, carsUnassigned: 0, totalSteps: 4 },
  },
  {
    name: "insufficient-capacity",
    description: "More vehicles than total slots — fail gracefully.",
    vehicles: [
      v("c1", "A", "Sports", [], null),
      v("c2", "B", "Sports", [], null),
      v("c3", "C", "Sports", [], null),
    ],
    properties: [
      p("only", "Only Apt", 2, []),
    ],
    intent: {
      criteria: [{ description: "everything", filter: { classes: ["Sports"] }, target: { property_id: "only" } }],
      unmatched_handling: "leave",
    },
    expect: { ok: false },
  },
];
