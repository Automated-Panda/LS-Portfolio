// lib/credits/adjust.test.ts
import { describe, it, expect } from "vitest";
import { parseCreditDelta } from "./adjust";

describe("parseCreditDelta", () => {
  it("parses positive, signed and negative whole numbers", () => {
    expect(parseCreditDelta("50")).toEqual({ ok: true, delta: 50 });
    expect(parseCreditDelta("+50")).toEqual({ ok: true, delta: 50 });
    expect(parseCreditDelta("-20")).toEqual({ ok: true, delta: -20 });
    expect(parseCreditDelta("  15 ")).toEqual({ ok: true, delta: 15 });
  });
  it("rejects empty, zero, non-integer and oversized input", () => {
    expect(parseCreditDelta("").ok).toBe(false);
    expect(parseCreditDelta("0").ok).toBe(false);
    expect(parseCreditDelta("3.5").ok).toBe(false);
    expect(parseCreditDelta("abc").ok).toBe(false);
    expect(parseCreditDelta("9999999").ok).toBe(false);
  });
});
