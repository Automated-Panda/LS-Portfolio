// app/admin/admin-image-cell.tsx
"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import type { ImageEntity } from "@/lib/admin/image-upload";
import { uploadCatalogImage, removeCatalogImage } from "./actions";

export function AdminImageCell({
  entity,
  id,
  initialUrl,
}: {
  entity: ImageEntity;
  id: string;
  initialUrl: string | null;
}) {
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file later
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    startTransition(async () => {
      const res = await uploadCatalogImage(entity, id, fd);
      if ("error" in res) toast.error(res.error);
      else setUrl(res.url);
    });
  };

  const remove = () => {
    startTransition(async () => {
      const res = await removeCatalogImage(entity, id);
      if ("error" in res) toast.error(res.error);
      else setUrl(null);
    });
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex h-10 w-14 shrink-0 items-center justify-center overflow-hidden rounded border bg-muted">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="h-full w-full object-contain" />
        ) : (
          <span className="text-[10px] text-muted-foreground">none</span>
        )}
      </div>
      <div className="flex flex-col gap-0.5">
        <button
          type="button"
          disabled={pending}
          onClick={() => inputRef.current?.click()}
          className="text-left text-xs underline disabled:opacity-50"
        >
          {pending ? "…" : "Replace"}
        </button>
        {url && (
          <button
            type="button"
            disabled={pending}
            onClick={remove}
            className="text-left text-xs text-muted-foreground underline disabled:opacity-50"
          >
            Remove
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFile}
      />
    </div>
  );
}
