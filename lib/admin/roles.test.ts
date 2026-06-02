// lib/admin/roles.test.ts
import { describe, it, expect } from "vitest";
import { resolveRole, isAdminRole, isOwnerRole } from "./roles";

const OWNER = "james@automatedpanda.com";

describe("resolveRole", () => {
  it("returns owner for the bootstrap email regardless of db role", () => {
    expect(resolveRole(null, OWNER, OWNER)).toBe("owner");
    expect(resolveRole("user", "JAMES@automatedpanda.com", OWNER)).toBe("owner");
  });
  it("honors the db role for non-bootstrap users", () => {
    expect(resolveRole("editor", "a@b.com", OWNER)).toBe("editor");
    expect(resolveRole("owner", "a@b.com", OWNER)).toBe("owner");
  });
  it("defaults unknown / null db roles to user", () => {
    expect(resolveRole(null, "a@b.com", OWNER)).toBe("user");
    expect(resolveRole("bogus", "a@b.com", OWNER)).toBe("user");
  });
  it("returns user when there is no email", () => {
    expect(resolveRole("owner", null, OWNER)).toBe("user");
  });
});

describe("isAdminRole / isOwnerRole", () => {
  it("admin = owner or editor", () => {
    expect(isAdminRole("owner")).toBe(true);
    expect(isAdminRole("editor")).toBe(true);
    expect(isAdminRole("user")).toBe(false);
  });
  it("owner only", () => {
    expect(isOwnerRole("owner")).toBe(true);
    expect(isOwnerRole("editor")).toBe(false);
  });
});
