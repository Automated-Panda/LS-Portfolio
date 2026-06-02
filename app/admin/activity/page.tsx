// app/admin/activity/page.tsx
import { redirect } from "next/navigation";

import { isOwner } from "@/lib/admin/guard";
import { createAdminClient } from "@/lib/supabase/admin";

import { AdminActivityList, type ActivityEntry } from "./admin-activity-list";

type LogRow = {
  id: string;
  actor_email: string | null;
  action: string;
  target_label: string | null;
  changes: unknown;
  created_at: string;
};

export default async function AdminActivityPage() {
  if (!(await isOwner())) redirect("/admin");

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("admin_activity_log")
    .select("id, actor_email, action, target_label, changes, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  const entries: ActivityEntry[] = ((data ?? []) as LogRow[]).map((r) => ({
    id: r.id,
    actorEmail: r.actor_email,
    action: r.action,
    targetLabel: r.target_label,
    changes: r.changes,
    createdAt: r.created_at,
  }));

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Activity log</h1>
      <p className="text-sm text-muted-foreground">Latest {entries.length} admin actions</p>
      <AdminActivityList entries={entries} />
    </div>
  );
}
