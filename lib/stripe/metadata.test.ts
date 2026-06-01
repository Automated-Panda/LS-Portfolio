import { describe, it, expect } from "vitest";
import { creditsFromMetadata } from "./metadata";

describe("creditsFromMetadata", () => {
  it("parses a positive integer credits string", () => {
    expect(creditsFromMetadata({ credits: "50" })).toBe(50);
  });
  it("throws on missing, non-numeric, zero, or negative credits", () => {
    expect(() => creditsFromMetadata({})).toThrow();
    expect(() => creditsFromMetadata(null)).toThrow();
    expect(() => creditsFromMetadata({ credits: "abc" })).toThrow();
    expect(() => creditsFromMetadata({ credits: "0" })).toThrow();
    expect(() => creditsFromMetadata({ credits: "-5" })).toThrow();
  });
});
