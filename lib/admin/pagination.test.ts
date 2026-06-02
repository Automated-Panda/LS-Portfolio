// lib/admin/pagination.test.ts
import { describe, it, expect } from "vitest";
import { pageBounds } from "./pagination";

describe("pageBounds", () => {
  it("computes total pages (ceil) and the slice window", () => {
    expect(pageBounds(250, 0, 100)).toEqual({ totalPages: 3, safePage: 0, start: 0, end: 100 });
    expect(pageBounds(250, 1, 100)).toEqual({ totalPages: 3, safePage: 1, start: 100, end: 200 });
    expect(pageBounds(250, 2, 100)).toEqual({ totalPages: 3, safePage: 2, start: 200, end: 300 });
  });
  it("clamps an out-of-range page into the valid range", () => {
    expect(pageBounds(250, 9, 100).safePage).toBe(2);
    expect(pageBounds(250, -3, 100).safePage).toBe(0);
  });
  it("always has at least one page, even when empty", () => {
    expect(pageBounds(0, 0, 100)).toEqual({ totalPages: 1, safePage: 0, start: 0, end: 100 });
  });
});
