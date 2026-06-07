// app/admin/support/admin-support-list.tsx
"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Flag, Inbox, Mail, MailOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  CATEGORIES,
  CATEGORY_ICON,
  PRIORITIES,
  STATUSES,
  categoryLabel,
  isResolvedStatus,
  priorityLabel,
  statusLabel,
  statusStyle,
} from "@/lib/support/tickets";
import {
  addTicketNote,
  setTicketPriority,
  setTicketRead,
  setTicketStatus,
} from "./actions";

export type SupportTicketView = {
  id: string;
  email: string;
  category: string;
  message: string;
  relatedItem: string | null;
  priority: string;
  status: string;
  createdAt: string;
  readAt: string | null;
  notes: { id: string; body: string; createdAt: string }[];
};

// Group/sort order — active states first, then the resolved bucket.
const STATUS_ORDER = ["new", "in_review", "planned", "fixed", "rejected", "closed"];

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}
function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
function relTime(iso: string): string {
  const sec = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return "now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
  if (sec < 604800) return `${Math.floor(sec / 86400)}d`;
  return `${Math.floor(sec / 604800)}w`;
}

export function AdminSupportList({ tickets }: { tickets: SupportTicketView[] }) {
  // Local copy so status/priority/read/notes feel instant; re-synced whenever
  // the server revalidates and hands us fresh props.
  const [items, setItems] = useState(tickets);
  useEffect(() => setItems(tickets), [tickets]);

  const [category, setCategory] = useState<string>("all");
  const [showResolved, setShowResolved] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Per-category unread counts (active tickets only — resolved ones are hidden
  // and shouldn't drive the badges).
  const unreadByCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of items) {
      if (t.readAt != null || isResolvedStatus(t.status)) continue;
      m.set(t.category, (m.get(t.category) ?? 0) + 1);
    }
    return m;
  }, [items]);
  const totalUnread = useMemo(
    () => [...unreadByCategory.values()].reduce((a, b) => a + b, 0),
    [unreadByCategory],
  );

  const inCategory = useMemo(
    () => items.filter((t) => category === "all" || t.category === category),
    [items, category],
  );
  const resolvedHidden = inCategory.filter((t) => isResolvedStatus(t.status)).length;
  const visible = showResolved
    ? inCategory
    : inCategory.filter((t) => !isResolvedStatus(t.status));

  // Group visible tickets by status, in STATUS_ORDER; newest first within a group.
  const groups = useMemo(() => {
    const byStatus = new Map<string, SupportTicketView[]>();
    for (const t of visible) {
      const arr = byStatus.get(t.status) ?? [];
      arr.push(t);
      byStatus.set(t.status, arr);
    }
    return STATUS_ORDER.filter((s) => byStatus.has(s)).map((s) => ({
      status: s,
      tickets: byStatus
        .get(s)!
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    }));
  }, [visible]);

  const selected = items.find((t) => t.id === selectedId) ?? null;

  // ---- mutators (optimistic local update + server action) -------------------
  const patch = (id: string, fields: Partial<SupportTicketView>) =>
    setItems((prev) => prev.map((t) => (t.id === id ? { ...t, ...fields } : t)));

  const open = (t: SupportTicketView) => {
    setSelectedId(t.id);
    if (t.readAt == null) {
      patch(t.id, { readAt: new Date().toISOString() });
      startTransition(() => void setTicketRead(t.id, true));
    }
  };
  const markUnread = (id: string) => {
    patch(id, { readAt: null });
    startTransition(() => void setTicketRead(id, false));
  };
  const changeStatus = (id: string, status: string) => {
    patch(id, { status });
    startTransition(() => void setTicketStatus(id, status));
  };
  const changePriority = (id: string, priority: string) => {
    patch(id, { priority });
    startTransition(() => void setTicketPriority(id, priority));
  };

  const tabs = [{ value: "all", label: "All", icon: "" }, ...CATEGORIES.map((c) => ({
    value: c.value,
    label: c.label.replace(" report", "").replace(" request", "").replace(" feedback", ""),
    icon: CATEGORY_ICON[c.value] ?? "",
  }))];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* Tabs + controls */}
      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
        {tabs.map((t) => {
          const n = t.value === "all" ? totalUnread : unreadByCategory.get(t.value) ?? 0;
          const active = category === t.value;
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => setCategory(t.value)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? "bg-[#84cc16] text-black"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {t.icon && <span>{t.icon}</span>}
              {t.label}
              {n > 0 && (
                <span
                  className={`rounded-full px-1.5 text-[10px] font-bold tabular-nums ${
                    active ? "bg-black/80 text-[#84cc16]" : "bg-red-600 text-white"
                  }`}
                >
                  {n}
                </span>
              )}
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-muted-foreground tabular-nums">
            {totalUnread} unread
          </span>
          <button
            type="button"
            onClick={() => setShowResolved((v) => !v)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${
              showResolved
                ? "border-foreground/30 bg-muted text-foreground"
                : "border-border bg-transparent text-muted-foreground hover:bg-muted/50"
            }`}
            aria-pressed={showResolved}
          >
            <span
              className={`h-3 w-5 rounded-full transition-colors ${showResolved ? "bg-[#84cc16]" : "bg-muted-foreground/30"} relative`}
            >
              <span
                className={`absolute top-0.5 h-2 w-2 rounded-full bg-white transition-all ${showResolved ? "left-2.5" : "left-0.5"}`}
              />
            </span>
            Show resolved
          </button>
        </div>
      </div>

      {/* Two-pane body */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border md:flex-row">
        {/* List */}
        <div className="flex min-h-0 flex-col overflow-y-auto border-b md:w-2/5 md:border-b-0 md:border-r">
          {visible.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-10 text-center text-sm text-muted-foreground">
              <Inbox className="h-6 w-6 opacity-50" />
              <p>Nothing here{category !== "all" ? " in this category" : ""}.</p>
            </div>
          ) : (
            groups.map((g) => {
              const st = statusStyle(g.status);
              return (
                <div key={g.status}>
                  <div className="sticky top-0 z-10 flex items-center gap-2 border-b bg-background/95 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider backdrop-blur">
                    <span className={`h-2 w-2 rounded-full ${st.dot}`} />
                    <span>
                      {statusLabel(g.status, category === "all" ? undefined : category)}
                    </span>
                    <span className="text-muted-foreground">· {g.tickets.length}</span>
                  </div>
                  {g.tickets.map((t) => (
                    <ListRow
                      key={t.id}
                      ticket={t}
                      selected={t.id === selectedId}
                      onClick={() => open(t)}
                    />
                  ))}
                </div>
              );
            })
          )}
          {!showResolved && resolvedHidden > 0 && (
            <button
              type="button"
              onClick={() => setShowResolved(true)}
              className="border-t px-3 py-2.5 text-center text-[11px] text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            >
              {resolvedHidden} resolved hidden — show
            </button>
          )}
        </div>

        {/* Detail */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {selected ? (
            <TicketDetail
              ticket={selected}
              onStatus={(s) => changeStatus(selected.id, s)}
              onPriority={(p) => changePriority(selected.id, p)}
              onMarkUnread={() => markUnread(selected.id)}
              onNoteAdded={(note) =>
                patch(selected.id, { notes: [...selected.notes, note] })
              }
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-10 text-center text-sm text-muted-foreground">
              <Mail className="h-7 w-7 opacity-40" />
              <p>Select a ticket to read it.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ListRow({
  ticket: t,
  selected,
  onClick,
}: {
  ticket: SupportTicketView;
  selected: boolean;
  onClick: () => void;
}) {
  const st = statusStyle(t.status);
  const unread = t.readAt == null;
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ borderLeftColor: st.accent }}
      className={`flex w-full flex-col gap-1 border-b border-l-[3px] px-3 py-2.5 text-left transition-colors ${
        selected ? "bg-muted" : "hover:bg-muted/40"
      }`}
    >
      <div className="flex items-center gap-2">
        {unread && <span className="h-2 w-2 shrink-0 rounded-full bg-[#84cc16]" />}
        <span title={categoryLabel(t.category)}>{CATEGORY_ICON[t.category]}</span>
        <span
          className={`truncate text-sm ${unread ? "font-bold text-foreground" : "text-foreground/80"}`}
        >
          {t.email}
        </span>
        {t.priority === "high" && (
          <span className="flex shrink-0 items-center gap-0.5 text-[10px] font-semibold text-rose-400">
            <Flag className="h-3 w-3" /> High
          </span>
        )}
        <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
          {relTime(t.createdAt)}
        </span>
      </div>
      <p
        className={`truncate text-xs ${unread ? "text-foreground/70" : "text-muted-foreground"}`}
      >
        {t.message}
      </p>
    </button>
  );
}

function TicketDetail({
  ticket: t,
  onStatus,
  onPriority,
  onMarkUnread,
  onNoteAdded,
}: {
  ticket: SupportTicketView;
  onStatus: (status: string) => void;
  onPriority: (priority: string) => void;
  onMarkUnread: () => void;
  onNoteAdded: (note: { id: string; body: string; createdAt: string }) => void;
}) {
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const st = statusStyle(t.status);

  // Legacy 'closed' tickets aren't in STATUSES — surface the value so the select
  // shows it (and lets you move it into an active/visible state).
  const statusOptions =
    t.status === "closed" ? [{ value: "closed", label: "Closed" }, ...STATUSES] : STATUSES;

  const addNote = () => {
    const body = note.trim();
    if (!body) return;
    setError(null);
    startTransition(async () => {
      const res = await addTicketNote(t.id, body);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      onNoteAdded({
        id: `tmp-${Date.now()}`,
        body,
        createdAt: new Date().toISOString(),
      });
      setNote("");
    });
  };

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-base">{CATEGORY_ICON[t.category]}</span>
          <strong className="text-sm">{categoryLabel(t.category)}</strong>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${st.chip}`}>
            {statusLabel(t.status, t.category)}
          </span>
          {t.priority === "high" && (
            <span className="flex items-center gap-1 rounded-full border border-rose-500/40 bg-rose-500/15 px-2 py-0.5 text-[11px] font-semibold text-rose-300">
              <Flag className="h-3 w-3" /> High priority
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span className="text-foreground/80">{t.email}</span>
          <span>·</span>
          <span>{fmtDateTime(t.createdAt)}</span>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onMarkUnread}
            disabled={t.readAt == null}
            className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
            title={t.readAt == null ? "Already unread" : "Mark as unread"}
          >
            <MailOpen className="h-3.5 w-3.5" /> Mark unread
          </button>
          <label className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs">
            <span className="text-muted-foreground">Status</span>
            <select
              value={t.status}
              onChange={(e) => onStatus(e.target.value)}
              className="bg-transparent text-xs font-medium outline-none"
            >
              {statusOptions.map((s) => (
                <option key={s.value} value={s.value} className="bg-background">
                  {statusLabel(s.value, t.category)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs">
            <span className="text-muted-foreground">Priority</span>
            <select
              value={t.priority}
              onChange={(e) => onPriority(e.target.value)}
              className="bg-transparent text-xs font-medium outline-none"
            >
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value} className="bg-background">
                  {priorityLabel(p.value)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* Message */}
      <p className="whitespace-pre-wrap p-4 text-sm leading-relaxed">{t.message}</p>
      {t.relatedItem && (
        <p className="mx-4 mb-3 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          🔗 Related: {t.relatedItem}
        </p>
      )}

      {/* Internal notes */}
      <div className="mt-auto border-t p-4">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Internal notes
        </p>
        {t.notes.length > 0 ? (
          <div className="mb-3 flex flex-col gap-1.5 border-l-2 border-[#84cc16]/50 pl-3">
            {t.notes.map((n) => (
              <p key={n.id} className="text-xs text-foreground/80">
                {n.body}{" "}
                <span className="text-muted-foreground/60">· {fmtDate(n.createdAt)}</span>
              </p>
            ))}
          </div>
        ) : (
          <p className="mb-3 text-xs text-muted-foreground/60">No notes yet.</p>
        )}
        <div className="flex gap-2">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addNote();
            }}
            placeholder="Add an internal note…"
            className="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm"
          />
          <Button
            size="sm"
            variant="outline"
            disabled={pending || !note.trim()}
            onClick={addNote}
          >
            Add
          </Button>
        </div>
        {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
      </div>
    </div>
  );
}
