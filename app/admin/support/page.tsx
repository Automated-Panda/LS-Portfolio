// app/admin/support/page.tsx
import { requireAdmin } from "@/lib/admin/guard";
import { createAdminClient } from "@/lib/supabase/admin";

import { AdminSupportList, type SupportTicketView } from "./admin-support-list";

type TicketRow = {
  id: string;
  user_id: string;
  category: string;
  message: string;
  related_item: string | null;
  priority: string;
  status: string;
  created_at: string;
};
type NoteRow = { id: string; ticket_id: string; body: string; created_at: string };

export default async function AdminSupportPage() {
  await requireAdmin();

  const supabase = createAdminClient();
  const [{ data: tickets }, { data: notes }, { data: authData }] = await Promise.all([
    supabase.from("support_tickets").select("*").order("created_at", { ascending: false }),
    supabase
      .from("support_ticket_notes")
      .select("*")
      .order("created_at", { ascending: true }),
    supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);

  const emailById = new Map((authData?.users ?? []).map((u) => [u.id, u.email ?? ""]));
  const notesByTicket = new Map<string, NoteRow[]>();
  for (const n of (notes ?? []) as NoteRow[]) {
    const arr = notesByTicket.get(n.ticket_id) ?? [];
    arr.push(n);
    notesByTicket.set(n.ticket_id, arr);
  }

  const rows: SupportTicketView[] = ((tickets ?? []) as TicketRow[]).map((t) => ({
    id: t.id,
    email: emailById.get(t.user_id) ?? "—",
    category: t.category,
    message: t.message,
    relatedItem: t.related_item,
    priority: t.priority,
    status: t.status,
    createdAt: t.created_at,
    notes: (notesByTicket.get(t.id) ?? []).map((n) => ({
      id: n.id,
      body: n.body,
      createdAt: n.created_at,
    })),
  }));

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Support inbox</h1>
      <p className="text-sm text-muted-foreground">{rows.length} tickets</p>
      <AdminSupportList tickets={rows} />
    </div>
  );
}
