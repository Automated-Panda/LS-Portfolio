// app/admin/admin-status-cell.tsx
"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import type { ImageEntity } from "@/lib/admin/image-upload";
import { CATALOG_STATUSES } from "@/lib/catalog/status";
import { setCatalogStatus } from "./actions";

export function AdminStatusCell({
  entity,
  id,
  initial,
}: {
  entity: ImageEntity;
  id: string;
  initial: string;
}) {
  const [status, setStatus] = useState(initial);
  const [pending, startTransition] = useTransition();

  const onChange = (next: string) => {
    const prev = status;
    setStatus(next); // optimistic
    startTransition(async () => {
      const res = await setCatalogStatus(entity, id, next);
      if ("error" in res) {
        toast.error(res.error);
        setStatus(prev);
      }
    });
  };

  return (
    <select
      value={status}
      disabled={pending}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 rounded-md border bg-background px-2 text-xs"
    >
      {CATALOG_STATUSES.map((s) => (
        <option key={s.value} value={s.value}>
          {s.label}
        </option>
      ))}
    </select>
  );
}
