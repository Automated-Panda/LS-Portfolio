// lib/admin/users-view.test.ts
import { describe, it, expect } from "vitest";
import { buildUserRow, isBanned } from "./users-view";

const NOW = 1_700_000_000_000;
const OWNER = "james@automatedpanda.com";

function base() {
  return {
    id: "u1",
    email: "a@b.com",
    createdAt: "2026-01-01T00:00:00Z",
    lastSignInAt: "2026-06-01T00:00:00Z",
    bannedUntil: null as string | null,
    displayName: "Alice",
    username: "alice",
    dbRole: "user" as string | null,
    ownerEmail: OWNER,
    credits: { freeMonthly: 10, subMonthly: 0, balanceCredits: 20, hasActiveSub: false },
    nowMs: NOW,
  };
}

describe("isBanned", () => {
  it("is false for null and past bans, true for a future ban", () => {
    expect(isBanned(null, NOW)).toBe(false);
    expect(isBanned("2020-01-01T00:00:00Z", NOW)).toBe(false);
    expect(isBanned("2999-01-01T00:00:00Z", NOW)).toBe(true);
  });
});

describe("buildUserRow", () => {
  it("sums credits and derives a Free plan with no active sub", () => {
    const row = buildUserRow(base());
    expect(row.credits).toBe(30);
    expect(row.plan).toBe("Free");
    expect(row.disabled).toBe(false);
    expect(row.role).toBe("user");
  });
  it("derives a Pro plan when the sub is active", () => {
    const row = buildUserRow({ ...base(), credits: { freeMonthly: 0, subMonthly: 250, balanceCredits: 0, hasActiveSub: true } });
    expect(row.plan).toBe("Pro");
    expect(row.hasActiveSub).toBe(true);
  });
  it("treats the owner email as owner regardless of db role", () => {
    expect(buildUserRow({ ...base(), email: OWNER, dbRole: "user" }).role).toBe("owner");
  });
  it("reports zero credits when there is no credits row", () => {
    expect(buildUserRow({ ...base(), credits: null }).credits).toBe(0);
  });
  it("marks an account disabled when banned in the future", () => {
    expect(buildUserRow({ ...base(), bannedUntil: "2999-01-01T00:00:00Z" }).disabled).toBe(true);
  });
});
