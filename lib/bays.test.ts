import { describe, it, expect } from "vitest";

import { bayBinding, isBayBound, bayPropertyLabel } from "./bays";

describe("bay bindings", () => {
  it("binds the MOC to a bunker", () => {
    expect(isBayBound("moc")).toBe(true);
    expect(bayBinding("moc")?.subtypes).toEqual(["bunker"]);
    expect(bayPropertyLabel("moc")).toBe("Bunker");
  });

  it("binds the Terrorbyte to a nightclub OR garment factory", () => {
    expect(bayBinding("terbyte")?.subtypes).toEqual([
      "nightclub",
      "garment-factory",
    ]);
    expect(bayPropertyLabel("terbyte")).toBe("Nightclub or Garment Factory");
  });

  it("keeps the weaponized single-subtype bays working", () => {
    expect(bayBinding("khanjali")?.subtypes).toEqual(["facility"]);
    expect(bayPropertyLabel("khanjali")).toBe("Facility");
    expect(bayPropertyLabel("cerberus")).toBe("Arena Workshop");
  });

  it("returns null for an unbound vehicle", () => {
    expect(isBayBound("banshee")).toBe(false);
    expect(bayPropertyLabel("banshee")).toBeNull();
  });
});
