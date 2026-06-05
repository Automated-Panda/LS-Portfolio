import { describe, expect, it } from "vitest";

import type { OwnedVehicleInstance } from "@/lib/queries/my-vehicles";

import { vehicleMatches } from "./filter-vehicles";
import type { VehicleFilter } from "./types";

// Minimal instance factory — only the fields the matcher reads matter.
function veh(over: Partial<OwnedVehicleInstance> = {}): OwnedVehicleInstance {
  return {
    id: "v1",
    vehicle_id: "banshee",
    display_name: "Banshee",
    class: "Sports",
    manufacturer_display: "Bravado",
    image_path: null,
    price: null,
    nickname: null,
    notes: null,
    custom_tags: [],
    is_favourite: false,
    tag_ids: [],
    storage: null,
    ...over,
  };
}

const mfrLookup = new Map<string, string>([["Bravado", "bravado"]]);

describe("vehicleMatches — favourites", () => {
  it("matches only favourites when favourites=true", () => {
    const filter: VehicleFilter = { favourites: true };
    expect(vehicleMatches(filter, veh({ is_favourite: true }), mfrLookup)).toBe(
      true,
    );
    expect(
      vehicleMatches(filter, veh({ is_favourite: false }), mfrLookup),
    ).toBe(false);
  });

  it("favourites=true counts as a real constraint (non-empty filter)", () => {
    // A filter with only favourites:true is NOT treated as the empty filter.
    expect(
      vehicleMatches({ favourites: true }, veh({ is_favourite: true }), mfrLookup),
    ).toBe(true);
  });

  it("favourites=false is not a constraint", () => {
    // favourites:false alone is an empty filter → matches nothing (defensive default).
    expect(
      vehicleMatches({ favourites: false }, veh({ is_favourite: true }), mfrLookup),
    ).toBe(false);
  });

  it("ANDs favourites with other fields (favourite Supers only)", () => {
    const filter: VehicleFilter = { favourites: true, classes: ["Super"] };
    // Favourite but wrong class → no.
    expect(
      vehicleMatches(
        filter,
        veh({ is_favourite: true, class: "Sports" }),
        mfrLookup,
      ),
    ).toBe(false);
    // Favourite AND Super → yes.
    expect(
      vehicleMatches(
        filter,
        veh({ is_favourite: true, class: "Super" }),
        mfrLookup,
      ),
    ).toBe(true);
    // Super but not favourite → no.
    expect(
      vehicleMatches(
        filter,
        veh({ is_favourite: false, class: "Super" }),
        mfrLookup,
      ),
    ).toBe(false);
  });
});
