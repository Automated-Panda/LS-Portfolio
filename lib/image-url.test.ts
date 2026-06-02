// lib/image-url.test.ts
import { describe, it, expect } from "vitest";
import { vehicleImageUrl } from "./vehicles";
import { propertyImageUrl } from "./properties";

describe("vehicleImageUrl", () => {
  it("returns an absolute https URL verbatim", () => {
    const u = "https://x.supabase.co/storage/v1/object/public/catalog-images/vehicles/a?t=1";
    expect(vehicleImageUrl(u)).toBe(u);
  });
  it("builds the legacy /vehicles path for a basename", () => {
    expect(vehicleImageUrl("data/images/vehicles/adder.webp")).toBe("/vehicles/adder.webp");
  });
  it("returns null for null", () => {
    expect(vehicleImageUrl(null)).toBeNull();
  });
});

describe("propertyImageUrl", () => {
  it("returns an absolute https URL verbatim", () => {
    const u = "https://x.supabase.co/storage/v1/object/public/catalog-images/properties/b?t=2";
    expect(propertyImageUrl(u)).toBe(u);
  });
  it("builds the legacy /properties path for a basename", () => {
    expect(propertyImageUrl("data/images/properties/maze-bank.webp")).toBe(
      "/properties/maze-bank.webp",
    );
  });
  it("returns null for null", () => {
    expect(propertyImageUrl(null)).toBeNull();
  });
});
