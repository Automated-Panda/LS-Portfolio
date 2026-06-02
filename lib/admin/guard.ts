import "server-only";

import { createClient } from "@/lib/supabase/server";
import { resolveRole, isAdminRole, isOwnerRole, type Role } from "./roles";

/**
 * Role resolution for the current request. profiles.role is the source of truth,
 * except ADMIN_EMAIL is ALWAYS owner (bootstrap / lockout safety net). Access is
 * enforced server-side here and re-checked in every admin server action.
 */
export async function getRole(): Promise<Role> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "user";
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  return resolveRole(
    profile?.role ?? null,
    user.email ?? null,
    process.env.ADMIN_EMAIL ?? null,
  );
}

/** True for owner OR editor — may access /admin. */
export async function isAdmin(): Promise<boolean> {
  return isAdminRole(await getRole());
}

/** True for owner only — may access owner-only areas (users, revenue, etc.). */
export async function isOwner(): Promise<boolean> {
  return isOwnerRole(await getRole());
}

/** Throws if the caller can't access /admin — call at the top of admin actions. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) {
    throw new Error("Forbidden: admin access required.");
  }
}

/** Throws if the caller isn't the owner — call at the top of owner-only actions. */
export async function requireOwner(): Promise<void> {
  if (!(await isOwner())) {
    throw new Error("Forbidden: owner access required.");
  }
}
