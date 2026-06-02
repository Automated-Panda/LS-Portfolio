// app/admin/support/admin-support-list.tsx
"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  STATUSES,
  PRIORITIES,
  categoryLabel,
  statusLabel,
  priorityLabel,
} from "@/lib/support/tickets";
import { setTicketStatus, setTicketPriority, addTicketNote } from "./actions";

export type SupportTicketView = {
  id: string;
  email: string;
  category: string;
  message: string;
  relatedItem: string | null;
  priority: string;
  status: string;
  createdAt: string;
  notes: { id: string; body: string; createdAt: string }[];
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

export function AdminSupportList({ tickets }: { tickets: SupportTicketView[] }) {
  const [filter, setFilter] = useState("all");
  const shown = tickets.filter((t) => filter === "all" || t.status === filter);

  return (
    <div className="space-y-4">
      <select
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="rounded-md border bg-background px-3 py-2 text-sm"
      >
        <option value="all">All statuses</option>
        {STATUSES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>

      <div className="space-y-3">
        {shown.map((t) => (
          <TicketCard key={t.id} ticket={t} />
        ))}
        {shown.length === 0 && (
          <p className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
            No tickets{filter !== "all" ? " with this status" : ""}.
          </p>
        )}
      </div>
    </div>
  );
}

function TicketCard({ ticket }: { ticket: SupportTicketView }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const run = (fn: () => Promise<{ ok: true } | { error: string }>) => {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if ("error" in res) setError(res.error);
      else setNote("");
    });
  };

  return (
    <div className="rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">{categoryLabel(ticket.category)}</span>
        <span className="rounded bg-muted px-1.5 py-0.5 text-xs">{statusLabel(ticket.status)}</span>
        <span className="rounded bg-muted px-1.5 py-0.5 text-xs">
          {priorityLabel(ticket.priority)}
        </span>
        <span className="text-muted-foreground">{ticket.email}</span>
        <span className="ml-auto text-xs text-muted-foreground">{fmtDate(ticket.createdAt)}</span>
      </div>

      <p className="mt-2 whitespace-pre-wrap text-sm">{ticket.message}</p>
      {ticket.relatedItem && (
        <p className="mt-1 text-xs text-muted-foreground">Related: {ticket.relatedItem}</p>
      )}

      <div className="mt-3 flex flex-wrap gap-3">
        <label className="text-xs text-muted-foreground">
          Status
          <select
            value={ticket.status}
            disabled={pending}
            onChange={(e) => run(() => setTicketStatus(ticket.id, e.target.value))}
            className="ml-1 rounded border bg-background px-1.5 py-1 text-xs"
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted-foreground">
          Priority
          <select
            value={ticket.priority}
            disabled={pending}
            onChange={(e) => run(() => setTicketPriority(ticket.id, e.target.value))}
            className="ml-1 rounded border bg-background px-1.5 py-1 text-xs"
          >
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {ticket.notes.length > 0 && (
        <div className="mt-3 space-y-1 border-l-2 pl-3">
          {ticket.notes.map((n) => (
            <p key={n.id} className="text-xs text-muted-foreground">
              {n.body} <span className="opacity-60">· {fmtDate(n.createdAt)}</span>
            </p>
          ))}
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add an internal note…"
          className="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm"
        />
        <Button
          size="sm"
          variant="outline"
          disabled={pending || !note.trim()}
          onClick={() => run(() => addTicketNote(ticket.id, note))}
        >
          Add
        </Button>
      </div>

      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
    </div>
  );
}
