// lib/admin/users-view.ts
// Pure assembly of the admin Users table row from auth + profile + credits data.
import { resolveRole, type Role } from "./roles";

export type AdminUserRow = {
  id: string;
  email: string;
  displayName: string | null;
  username: string | null;
  role: Role;
  plan: "Free" | "Pro";
  disabled: boolean;
  hasActiveSub: boolean;
  credits: number;
  signupAt: string;
  lastSignInAt: string | null;
};

export function isBanned(bannedUntil: string | null, nowMs: number): boolean {
  if (!bannedUntil) return false;
  const t = new Date(bannedUntil).getTime();
  return Number.isFinite(t) && t > nowMs;
}

export function buildUserRow(input: {
  id: string;
  email: string;
  createdAt: string;
  lastSignInAt: string | null;
  bannedUntil: string | null;
  displayName: string | null;
  username: string | null;
  dbRole: string | null;
  ownerEmail: string | null;
  credits: {
    freeMonthly: number;
    subMonthly: number;
    balanceCredits: number;
    hasActiveSub: boolean;
  } | null;
  nowMs: number;
}): AdminUserRow {
  const role = resolveRole(input.dbRole, input.email, input.ownerEmail);
  const hasActiveSub = input.credits?.hasActiveSub ?? false;
  const credits = input.credits
    ? input.credits.freeMonthly + input.credits.subMonthly + input.credits.balanceCredits
    : 0;
  return {
    id: input.id,
    email: input.email,
    displayName: input.displayName,
    username: input.username,
    role,
    plan: hasActiveSub ? "Pro" : "Free",
    disabled: isBanned(input.bannedUntil, input.nowMs),
    hasActiveSub,
    credits,
    signupAt: input.createdAt,
    lastSignInAt: input.lastSignInAt,
  };
}
