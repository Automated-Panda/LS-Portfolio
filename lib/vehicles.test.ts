import { describe, it, expect } from "vitest";
import { propertyAcceptsVehicleCategory } from "./vehicles";

const p = (subtype: string, counts_as_garage: boolean) => ({
  subtype,
  counts_as_garage,
});

describe("propertyAcceptsVehicleCategory", () => {
  it("accepts a hangar for air vehicles even though counts_as_garage is false", () => {
    expect(propertyAcceptsVehicleCategory(p("hangar", false), "air")).toBe(true);
  });
  it("accepts a yacht for sea vehicles (counts_as_garage false)", () => {
    expect(propertyAcceptsVehicleCategory(p("yacht", false), "sea")).toBe(true);
  });
  it("accepts a car garage for land vehicles", () => {
    expect(
      propertyAcceptsVehicleCategory(p("stand-alone-garage", true), "land"),
    ).toBe(true);
  });
  it("rejects a non-garage land property (cargo warehouse) for land vehicles", () => {
    expect(
      propertyAcceptsVehicleCategory(p("cargo-warehouse-large", false), "land"),
    ).toBe(false);
  });
  it("rejects category mismatches", () => {
    expect(propertyAcceptsVehicleCategory(p("hangar", false), "land")).toBe(false);
    expect(propertyAcceptsVehicleCategory(p("stand-alone-garage", true), "air")).toBe(
      false,
    );
  });
});
