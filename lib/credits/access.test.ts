import { describe, it, expect, afterEach } from "vitest";
import { isUnlimitedEmail } from "./access";

const ORIGINAL = process.env.ADMIN_EMAIL;
afterEach(() => {
  process.env.ADMIN_EMAIL = ORIGINAL;
});

describe("isUnlimitedEmail", () => {
  it("is true for the owner email (case-insensitive)", () => {
    process.env.ADMIN_EMAIL = "james@automatedpanda.com";
    expect(isUnlimitedEmail("james@automatedpanda.com")).toBe(true);
    expect(isUnlimitedEmail("James@AutomatedPanda.com")).toBe(true);
  });
  it("is false for any other email", () => {
    process.env.ADMIN_EMAIL = "james@automatedpanda.com";
    expect(isUnlimitedEmail("someone@else.com")).toBe(false);
  });
  it("is false for null/undefined email or unset ADMIN_EMAIL", () => {
    process.env.ADMIN_EMAIL = "james@automatedpanda.com";
    expect(isUnlimitedEmail(null)).toBe(false);
    expect(isUnlimitedEmail(undefined)).toBe(false);
    delete process.env.ADMIN_EMAIL;
    expect(isUnlimitedEmail("james@automatedpanda.com")).toBe(false);
  });
});
