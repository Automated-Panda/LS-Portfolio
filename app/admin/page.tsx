import Link from "next/link";

import { getRole } from "@/lib/admin/guard";
import { isOwnerRole } from "@/lib/admin/roles";
import { createAdminClient } from "@/lib/supabase/admin";

const SECTIONS = [
  { href: "/admin/vehicles", title: "Vehicles", desc: "Edit price, availability, and vendors." },
  { href: "/admin/properties", title: "Properties & Businesses", desc: "Edit price, capacity, and garage flag." },
  { href: "/admin/upgrades", title: "Upgrades", desc: "Edit upgrade names, capacity, and price." },
];

async function ownerStats() {
  const supabase = createAdminClient();
  const [{ count: totalUsers }, { count: paidUsers }, { data: credits }] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("user_credits").select("*", { count: "exact", head: true }).eq("has_active_sub", true),
    supabase.from("user_credits").select("balance_credits"),
  ]);
  const outstanding = (credits ?? []).reduce(
    (sum, r) => sum + ((r as { balance_credits: number }).balance_credits ?? 0),
    0,
  );
  return { totalUsers: totalUsers ?? 0, paidUsers: paidUsers ?? 0, outstanding };
}

export default async function AdminHome() {
  const role = await getRole();
  const owner = isOwnerRole(role);
  const stats = owner ? await ownerStats() : null;

  return (
    <div className="space-y-8">
      {stats && (
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: "Total users", value: stats.totalUsers },
            { label: "Paid users", value: stats.paidUsers },
            { label: "Credits outstanding", value: stats.outstanding },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">{s.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {SECTIONS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="rounded-lg border p-4 transition-colors hover:border-foreground/40"
          >
            <p className="font-medium">{s.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
