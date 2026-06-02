// app/admin/users/page.tsx
import { redirect } from "next/navigation";

import { isOwner } from "@/lib/admin/guard";
import { buildUserRow, type AdminUserRow } from "@/lib/admin/users-view";
import { createAdminClient } from "@/lib/supabase/admin";

import { AdminUsersTable } from "./admin-users-table";

type ProfileRow = { id: string; display_name: string | null; username: string | null; role: string | null };
type CreditRow = {
  user_id: string;
  free_monthly: number;
  sub_monthly: number;
  balance_credits: number;
  has_active_sub: boolean;
};

export default async function AdminUsersPage() {
  if (!(await isOwner())) redirect("/admin");

  const supabase = createAdminClient();
  const ownerEmail = process.env.ADMIN_EMAIL ?? null;
  const now = Date.now();

  const { data: authData, error: authErr } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (authErr) throw new Error(`listUsers failed: ${authErr.message}`);

  const [{ data: profiles }, { data: credits }] = await Promise.all([
    supabase.from("profiles").select("id, display_name, username, role"),
    supabase
      .from("user_credits")
      .select("user_id, free_monthly, sub_monthly, balance_credits, has_active_sub"),
  ]);

  const profileById = new Map((profiles ?? []).map((p) => [(p as ProfileRow).id, p as ProfileRow]));
  const creditByUser = new Map(
    (credits ?? []).map((c) => [(c as CreditRow).user_id, c as CreditRow]),
  );

  const rows: AdminUserRow[] = authData.users.map((u) => {
    const p = profileById.get(u.id);
    const c = creditByUser.get(u.id);
    return buildUserRow({
      id: u.id,
      email: u.email ?? "",
      createdAt: u.created_at,
      lastSignInAt: u.last_sign_in_at ?? null,
      bannedUntil: (u as { banned_until?: string | null }).banned_until ?? null,
      displayName: p?.display_name ?? null,
      username: p?.username ?? null,
      dbRole: p?.role ?? null,
      ownerEmail,
      credits: c
        ? {
            freeMonthly: c.free_monthly,
            subMonthly: c.sub_monthly,
            balanceCredits: c.balance_credits,
            hasActiveSub: c.has_active_sub,
          }
        : null,
      nowMs: now,
    });
  });

  rows.sort((a, b) => b.signupAt.localeCompare(a.signupAt));

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Users</h1>
      <p className="text-sm text-muted-foreground">{rows.length} total</p>
      <AdminUsersTable users={rows} />
    </div>
  );
}
