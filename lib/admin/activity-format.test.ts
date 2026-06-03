// lib/admin/activity-format.test.ts
import { describe, it, expect } from "vitest";
import { diffFields, actionLabel, formatActivityDetail, formatValue } from "./activity-format";

describe("diffFields", () => {
  it("returns only the changed fields", () => {
    const before = { display_name: "Adder", price: 1000000 };
    const after = { display_name: "Adder", price: 1100000 };
    expect(diffFields(before, after, ["display_name", "price"])).toEqual([
      { field: "price", from: 1000000, to: 1100000 },
    ]);
  });
  it("treats missing values as null", () => {
    expect(diffFields({}, { neighborhood: "Vinewood" }, ["neighborhood"])).toEqual([
      { field: "neighborhood", from: null, to: "Vinewood" },
    ]);
  });
  it("compares arrays shallowly", () => {
    expect(diffFields({ vendors: ["a"] }, { vendors: ["a"] }, ["vendors"])).toEqual([]);
    expect(diffFields({ vendors: ["a"] }, { vendors: ["a", "b"] }, ["vendors"])).toEqual([
      { field: "vendors", from: ["a"], to: ["a", "b"] },
    ]);
  });
  it("only considers the listed fields", () => {
    expect(diffFields({ a: 1, b: 2 }, { a: 9, b: 9 }, ["b"])).toEqual([
      { field: "b", from: 2, to: 9 },
    ]);
  });
  it("returns empty when nothing changed", () => {
    expect(diffFields({ a: 1 }, { a: 1 }, ["a"])).toEqual([]);
  });
});

describe("actionLabel", () => {
  it("maps known codes to human labels", () => {
    expect(actionLabel("vehicle.update")).toBe("edited vehicle");
    expect(actionLabel("user.role")).toBe("changed role");
  });
  it("returns the code itself for unknown actions", () => {
    expect(actionLabel("mystery.code")).toBe("mystery.code");
  });
});

describe("formatValue", () => {
  it("renders null/empty as an em dash", () => {
    expect(formatValue("price", null)).toBe("—");
    expect(formatValue("neighborhood", "")).toBe("—");
  });
  it("formats prices with a $ and thousands separators", () => {
    expect(formatValue("price", 1500000)).toBe("$1,500,000");
  });
  it("renders booleans as Yes/No and arrays as a list", () => {
    expect(formatValue("counts_as_garage", true)).toBe("Yes");
    expect(formatValue("vendors", ["a", "b"])).toBe("a, b");
    expect(formatValue("vendors", [])).toBe("—");
  });
});

describe("formatActivityDetail", () => {
  it("formats content field-change arrays with human labels + values", () => {
    expect(
      formatActivityDetail("vehicle.update", [{ field: "price", from: 1000000, to: 1100000 }]),
    ).toEqual(["Price: $1,000,000 → $1,100,000"]);
  });
  it("summarizes a role change", () => {
    expect(formatActivityDetail("user.role", { from: "user", to: "editor" })).toEqual([
      "user → editor",
    ]);
  });
  it("summarizes a credit adjustment with note and new balance", () => {
    expect(
      formatActivityDetail("user.credits", { delta: 50, note: "welcome gift", newTotal: 150 }),
    ).toEqual(["+50 credits (new balance 150)", "Note: welcome gift"]);
  });
  it("summarizes account disable/enable", () => {
    expect(formatActivityDetail("user.disabled", { to: true })).toEqual(["Account disabled"]);
    expect(formatActivityDetail("user.disabled", { to: false })).toEqual(["Account re-enabled"]);
  });
  it("shows the note text for a ticket note", () => {
    expect(formatActivityDetail("ticket.note", { note: "Investigating" })).toEqual([
      "“Investigating”",
    ]);
  });
  it("returns nothing for empty changes", () => {
    expect(formatActivityDetail("image.upload", {})).toEqual([]);
    expect(formatActivityDetail("user.role", null)).toEqual([]);
  });
});
