import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * The /admin catalog editor is gated to a single email (ADMIN_EMAIL env var),
 * which MUST match the email used to sign into the app. The check runs
 * server-side in the admin layout (page access) and again in every admin
 * server action (write access) — RLS keeps the catalog read-only for everyone
 * else, so a leaked route can't mutate anything.
 */
export async function isAdmin(): Promise<boolean> {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return false;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email;
  if (!email) return false;
  return email.toLowerCase() === adminEmail.toLowerCase();
}

/** Throws if the caller isn't the admin — call at the top of every admin action. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) {
    throw new Error("Forbidden: admin access required.");
  }
}
