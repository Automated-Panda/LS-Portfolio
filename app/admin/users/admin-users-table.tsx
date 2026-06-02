// app/admin/users/admin-users-table.tsx
"use client";

import { useState, useTransition } from "react";

import type { Role } from "@/lib/admin/roles";
import type { AdminUserRow } from "@/lib/admin/users-view";
import { Button } from "@/components/ui/button";
import { adjustUserCredits, setUserRole, setUserDisabled } from "./actions";

const ROLES: Role[] = ["user", "editor", "owner"];

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString();
}

export function AdminUsersTable({ users }: { users: AdminUserRow[] }) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<AdminUserRow | null>(null);

  const filtered = users.filter((u) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      u.email.toLowerCase().includes(q) ||
      (u.displayName ?? "").toLowerCase().includes(q) ||
      (u.username ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name or email…"
        className="w-full max-w-sm rounded-md border bg-background px-3 py-2 text-sm"
      />

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">User</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Plan</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Credits</th>
              <th className="px-3 py-2">Signup</th>
              <th className="px-3 py-2">Last login</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <UserRow key={u.id} user={u} onAdjust={() => setEditing(u)} />
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                  No users match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <AdjustCreditsModal user={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

function UserRow({ user, onAdjust }: { user: AdminUserRow; onAdjust: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const changeRole = (role: Role) => {
    setError(null);
    startTransition(async () => {
      const res = await setUserRole(user.id, role);
      if ("error" in res) setError(res.error);
    });
  };

  const toggleDisabled = () => {
    setError(null);
    startTransition(async () => {
      const res = await setUserDisabled(user.id, !user.disabled);
      if ("error" in res) setError(res.error);
    });
  };

  return (
    <tr className="border-b last:border-0">
      <td className="px-3 py-2">
        <div className="font-medium">{user.displayName || user.username || "—"}</div>
        <div className="text-xs text-muted-foreground">{user.email}</div>
        {error && <div className="text-xs text-red-500">{error}</div>}
      </td>
      <td className="px-3 py-2">
        <select
          value={user.role}
          disabled={pending}
          onChange={(e) => changeRole(e.target.value as Role)}
          className="rounded border bg-background px-1.5 py-1 text-xs"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2">{user.plan}</td>
      <td className="px-3 py-2">
        {user.disabled ? (
          <span className="text-red-500">Disabled</span>
        ) : (
          <span className="text-[#65a30d]">Active</span>
        )}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">{user.credits}</td>
      <td className="px-3 py-2">{fmtDate(user.signupAt)}</td>
      <td className="px-3 py-2">{fmtDate(user.lastSignInAt)}</td>
      <td className="px-3 py-2">
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={onAdjust} disabled={pending}>
            Credits
          </Button>
          <Button size="sm" variant="outline" onClick={toggleDisabled} disabled={pending}>
            {user.disabled ? "Enable" : "Disable"}
          </Button>
        </div>
      </td>
    </tr>
  );
}

function AdjustCreditsModal({
  user,
  onClose,
}: {
  user: AdminUserRow;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = await adjustUserCredits(user.id, amount, note);
      if ("error" in res) {
        setError(res.error);
      } else {
        onClose();
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-lg border bg-card p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">Adjust credits</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {user.email} — currently {user.credits} credits.
        </p>
        <label className="mt-4 block text-sm font-medium">Amount (use - to deduct)</label>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="e.g. 50 or -20"
          className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
        <label className="mt-3 block text-sm font-medium">Note (optional)</label>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. launch gift"
          className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Saving…" : "Apply"}
          </Button>
        </div>
      </div>
    </div>
  );
}
