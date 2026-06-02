// lib/catalog/status.test.ts
import { describe, it, expect } from "vitest";
import { CATALOG_STATUSES, isValidCatalogStatus, statusLabel } from "./status";

describe("CATALOG_STATUSES", () => {
  it("has draft, published, archived", () => {
    expect(CATALOG_STATUSES.map((s) => s.value)).toEqual(["draft", "published", "archived"]);
  });
});

describe("isValidCatalogStatus", () => {
  it("accepts the three states and rejects others", () => {
    expect(isValidCatalogStatus("draft")).toBe(true);
    expect(isValidCatalogStatus("published")).toBe(true);
    expect(isValidCatalogStatus("archived")).toBe(true);
    expect(isValidCatalogStatus("live")).toBe(false);
    expect(isValidCatalogStatus("")).toBe(false);
  });
});

describe("statusLabel", () => {
  it("maps values to labels, falling back to the value", () => {
    expect(statusLabel("published")).toBe("Published");
    expect(statusLabel("draft")).toBe("Draft");
    expect(statusLabel("unknown")).toBe("unknown");
  });
});
