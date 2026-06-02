// app/admin/revenue/page.tsx
import { redirect } from "next/navigation";

import { isOwner } from "@/lib/admin/guard";
import { getRevenueData } from "@/lib/stripe/revenue";
import {
  computeMrr,
  subCounts,
  totalRevenue,
  arpu,
  planBreakdown,
  recentPayments,
  failedPayments,
  formatCents,
  type ChargeRecord,
} from "@/lib/stripe/revenue-metrics";

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString();
}

export default async function AdminRevenuePage() {
  if (!(await isOwner())) redirect("/admin");

  const data = await getRevenueData();

  if (!data.ok) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Revenue</h1>
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          Stripe is unavailable: {data.reason}
        </div>
      </div>
    );
  }

  const { subs, charges, testMode } = data;
  const mrr = computeMrr(subs);
  const counts = subCounts(subs);
  const total = totalRevenue(charges);
  const monthlyArpu = arpu(mrr, counts.active);
  const breakdown = planBreakdown(subs, charges);
  const recent = recentPayments(charges, 10);
  const failed = failedPayments(charges);

  const cards = [
    { label: "MRR", value: formatCents(mrr) },
    { label: "Total revenue", value: formatCents(total) },
    {
      label: "Active subs",
      value: `${counts.active}${counts.canceled ? ` (${counts.canceled} cancelled)` : ""}`,
    },
    { label: "ARPU", value: formatCents(monthlyArpu) },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">Revenue</h1>
        {testMode && (
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-600">
            Test data
          </span>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">{c.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{c.value}</p>
          </div>
        ))}
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Plan breakdown
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {breakdown.map((b) => (
            <div key={b.tier} className="rounded-lg border p-4">
              <p className="font-medium">
                {b.tier}
                {b.tier === "Pro" ? " /mo" : ""}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {b.count} × · {formatCents(b.totalCents)}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <PaymentList title="Recent payments" rows={recent} emptyText="No payments yet." />
        <PaymentList title="Failed / past-due" rows={failed} emptyText="None — all clear." />
      </div>
    </div>
  );
}

function PaymentList({
  title,
  rows,
  emptyText,
}: {
  title: string;
  rows: ChargeRecord[];
  emptyText: string;
}) {
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      <div className="overflow-hidden rounded-lg border">
        {rows.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="px-3 py-2">{r.email ?? "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCents(r.amountCents)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{fmtDate(r.createdAt)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
