// lib/admin/activity-format.test.ts
import { describe, it, expect } from "vitest";
import { diffFields, actionLabel } from "./activity-format";

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
