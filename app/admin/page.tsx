import {
  Building2,
  Car,
  CreditCard,
  type LucideIcon,
  LifeBuoy,
  LineChart,
  ScrollText,
  Ticket,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";
import Link from "next/link";

import { actionLabel } from "@/lib/admin/activity-format";
import { getRole } from "@/lib/admin/guard";
import { isOwnerRole } from "@/lib/admin/roles";
import { createAdminClient } from "@/lib/supabase/admin";

type Stat = { label: string; value: number; icon: LucideIcon };
type ActivityRow = {
  actor_email: string | null;
  action: string;
  target_label: string | null;
  created_at: string;
};

const CONTENT_LINKS = [
  { href: "/admin/vehicles", title: "Vehicles", desc: "Price, availability, images, status.", icon: Car },
  { href: "/admin/properties", title: "Properties & Businesses", desc: "Capacity, price, images, status.", icon: Building2 },
  { href: "/admin/upgrades", title: "Upgrades", desc: "Upgrade names, capacity, price.", icon: Wrench },
  { href: "/admin/support", title: "Support inbox", desc: "Triage feedback & bug reports.", icon: LifeBuoy },
];
const OWNER_LINKS = [
  { href: "/admin/users", title: "Users", desc: "Roles, credits, account status.", icon: Users },
  { href: "/admin/revenue", title: "Revenue", desc: "MRR, payments, ARPU.", icon: LineChart },
  { href: "/admin/activity", title: "Activity log", desc: "Audit of admin actions.", icon: ScrollText },
];

async function ownerOverview(): Promise<{ stats: Stat[]; activity: ActivityRow[] }> {
  const supabase = createAdminClient();
  const [
    { count: totalUsers },
    { count: paidUsers },
    { count: openTickets },
    { data: credits },
    { data: activity },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("user_credits").select("*", { count: "exact", head: true }).eq("has_active_sub", true),
    supabase
      .from("support_tickets")
      .select("*", { count: "exact", head: true })
      .in("status", ["new", "in_review", "planned"]),
    supabase.from("user_credits").select("balance_credits"),
    supabase
      .from("admin_activity_log")
      .select("actor_email, action, target_label, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);
  const outstanding = (credits ?? []).reduce(
    (sum, r) => sum + ((r as { balance_credits: number }).balance_credits ?? 0),
    0,
  );
  return {
    stats: [
      { label: "Total users", value: totalUsers ?? 0, icon: Users },
      { label: "Paid users", value: paidUsers ?? 0, icon: CreditCard },
      { label: "Open tickets", value: openTickets ?? 0, icon: Ticket },
      { label: "Credits outstanding", value: outstanding, icon: Wallet },
    ],
    activity: (activity ?? []) as ActivityRow[],
  };
}

export default async function AdminHome() {
  const role = await getRole();
  const owner = isOwnerRole(role);
  const data = owner ? await ownerOverview() : null;
  const links = owner ? [...CONTENT_LINKS, ...OWNER_LINKS] : CONTENT_LINKS;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {owner
            ? "Your control centre — content, users, revenue, support & audit."
            : "Manage GT Vault catalog content & support."}
        </p>
      </div>

      {data && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {data.stats.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="rounded-xl border bg-card p-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#84cc16]/10 text-[#84cc16]">
                  <Icon className="h-5 w-5" />
                </div>
                <p className="mt-3 text-2xl font-semibold tabular-nums">{s.value}</p>
                <p className="text-sm text-muted-foreground">{s.label}</p>
              </div>
            );
          })}
        </div>
      )}

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Manage
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {links.map((l) => {
            const Icon = l.icon;
            return (
              <Link
                key={l.href}
                href={l.href}
                className="group rounded-xl border bg-card p-4 transition-colors hover:border-[#84cc16]/40"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-foreground transition-colors group-hover:bg-[#84cc16]/10 group-hover:text-[#84cc16]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="font-medium">{l.title}</p>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{l.desc}</p>
              </Link>
            );
          })}
        </div>
      </div>

      {data && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Recent activity
            </h2>
            <Link href="/admin/activity" className="text-xs text-[#84cc16] hover:underline">
              View all
            </Link>
          </div>
          <div className="divide-y rounded-xl border bg-card">
            {data.activity.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              data.activity.map((a, i) => (
                <div key={i} className="flex flex-wrap items-center gap-x-2 p-3 text-sm">
                  <span className="font-medium">{a.actor_email ?? "—"}</span>
                  <span className="text-muted-foreground">{actionLabel(a.action)}</span>
                  {a.target_label && <span className="font-medium">{a.target_label}</span>}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {new Date(a.created_at).toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
