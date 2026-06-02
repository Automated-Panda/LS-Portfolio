# Admin Catalog Image Upload/Replace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins upload/replace/remove the image of any vehicle or property (incl. businesses) from the admin editors, storing uploads in Supabase Storage and serving them via CDN, with existing static images still working.

**Architecture:** Uploaded images store an absolute Storage URL in the existing `image_path` column (no schema column); a one-line branch in the image-URL helpers returns absolute URLs verbatim. A pure module validates files + builds storage keys/URLs. Service-role admin actions upload to a public `catalog-images` bucket. A shared client cell adds Replace/Remove to both admin tables.

**Tech Stack:** Next.js (App Router, server actions, FormData), Supabase Storage + Postgres, TypeScript, Vitest, Tailwind.

**Spec:** `docs/superpowers/specs/2026-06-02-admin-image-upload-design.md`

**Refinement vs spec:** storage keys are **extension-less** (`{entity}/{id}`) so each item has exactly one object (re-uploads upsert in place — no orphaned files). `validateImageFile` therefore returns `{ ok }` without an extension.

---

## File Structure

- Create `lib/admin/image-upload.ts` (+ test) — pure validation + key/URL builders.
- Modify `lib/vehicles.ts` + `lib/properties.ts` — absolute-URL passthrough in the helpers; add `lib/image-url.test.ts`.
- Create `supabase/migrations/0029_catalog_images_bucket.sql` — the public bucket.
- Modify `app/admin/actions.ts` — `uploadCatalogImage` + `removeCatalogImage`.
- Modify `next.config.ts` — Supabase Storage remote pattern.
- Create `app/admin/admin-image-cell.tsx` — shared Replace/Remove cell.
- Modify `app/admin/vehicles/page.tsx` + `admin-vehicles-table.tsx` — image column.
- Modify `app/admin/properties/page.tsx` + `admin-properties-table.tsx` — image column.

---

## Task 1: Pure image-upload module

**Files:**
- Create: `lib/admin/image-upload.ts`
- Test: `lib/admin/image-upload.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/admin/image-upload.test.ts
import { describe, it, expect } from "vitest";
import { validateImageFile, storageKey, publicImageUrl, MAX_IMAGE_BYTES } from "./image-upload";

describe("validateImageFile", () => {
  it("accepts webp/png/jpeg under the size cap", () => {
    expect(validateImageFile({ type: "image/webp", size: 1000 }).ok).toBe(true);
    expect(validateImageFile({ type: "image/png", size: 1000 }).ok).toBe(true);
    expect(validateImageFile({ type: "image/jpeg", size: 1000 }).ok).toBe(true);
  });
  it("rejects a non-image type", () => {
    expect(validateImageFile({ type: "application/pdf", size: 1000 }).ok).toBe(false);
  });
  it("rejects an empty file", () => {
    expect(validateImageFile({ type: "image/png", size: 0 }).ok).toBe(false);
  });
  it("rejects a file over the size cap", () => {
    expect(validateImageFile({ type: "image/png", size: MAX_IMAGE_BYTES + 1 }).ok).toBe(false);
  });
});

describe("storageKey", () => {
  it("builds an extension-less {entity}/{id} key", () => {
    expect(storageKey("vehicles", "abc")).toBe("vehicles/abc");
    expect(storageKey("properties", "xyz")).toBe("properties/xyz");
  });
});

describe("publicImageUrl", () => {
  it("points at the catalog-images public path for the key", () => {
    expect(publicImageUrl("vehicles/abc")).toContain(
      "/storage/v1/object/public/catalog-images/vehicles/abc",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/admin/image-upload.test.ts`
Expected: FAIL — `Cannot find module './image-upload'`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/admin/image-upload.ts
// Pure helpers for admin catalog image uploads (no I/O).

export const IMAGE_TYPES = ["image/webp", "image/png", "image/jpeg"] as const;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

export type ImageEntity = "vehicles" | "properties";

export function validateImageFile(file: {
  type: string;
  size: number;
}): { ok: true } | { ok: false; error: string } {
  if (file.size <= 0) return { ok: false, error: "The file is empty." };
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, error: "Use a WebP, PNG, or JPEG image." };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, error: "Image must be 5 MB or smaller." };
  }
  return { ok: true };
}

/** Stable, extension-less object key — one object per catalog item. */
export function storageKey(entity: ImageEntity, id: string): string {
  return `${entity}/${id}`;
}

export function publicImageUrl(key: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${base}/storage/v1/object/public/catalog-images/${key}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/admin/image-upload.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/admin/image-upload.ts lib/admin/image-upload.test.ts
git commit -m "feat(admin): pure image-upload validation + storage key/url helpers"
```

---

## Task 2: Image-URL helper passthrough

**Files:**
- Modify: `lib/vehicles.ts`
- Modify: `lib/properties.ts`
- Test: `lib/image-url.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/image-url.test.ts
import { describe, it, expect } from "vitest";
import { vehicleImageUrl } from "./vehicles";
import { propertyImageUrl } from "./properties";

describe("vehicleImageUrl", () => {
  it("returns an absolute https URL verbatim", () => {
    const u = "https://x.supabase.co/storage/v1/object/public/catalog-images/vehicles/a?t=1";
    expect(vehicleImageUrl(u)).toBe(u);
  });
  it("builds the legacy /vehicles path for a basename", () => {
    expect(vehicleImageUrl("data/images/vehicles/adder.webp")).toBe("/vehicles/adder.webp");
  });
  it("returns null for null", () => {
    expect(vehicleImageUrl(null)).toBeNull();
  });
});

describe("propertyImageUrl", () => {
  it("returns an absolute https URL verbatim", () => {
    const u = "https://x.supabase.co/storage/v1/object/public/catalog-images/properties/b?t=2";
    expect(propertyImageUrl(u)).toBe(u);
  });
  it("builds the legacy /properties path for a basename", () => {
    expect(propertyImageUrl("data/images/properties/maze-bank.webp")).toBe(
      "/properties/maze-bank.webp",
    );
  });
  it("returns null for null", () => {
    expect(propertyImageUrl(null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/image-url.test.ts`
Expected: FAIL — the absolute-URL cases fail (current helpers strip to basename).

- [ ] **Step 3: Update both helpers**

In `lib/vehicles.ts`, replace the `vehicleImageUrl` function body so it reads EXACTLY:
```ts
export function vehicleImageUrl(imagePath: string | null): string | null {
  if (!imagePath) return null;
  if (/^https?:\/\//.test(imagePath)) return imagePath;
  const basename = imagePath.split("/").pop();
  return basename ? `/vehicles/${basename}` : null;
}
```

In `lib/properties.ts`, replace the `propertyImageUrl` function body so it reads EXACTLY:
```ts
export function propertyImageUrl(imagePath: string | null): string | null {
  if (!imagePath) return null;
  if (/^https?:\/\//.test(imagePath)) return imagePath;
  const basename = imagePath.split("/").pop();
  return basename ? `/properties/${basename}` : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/image-url.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

Run: `npm run typecheck` (expected: no errors), then:
```bash
git add lib/vehicles.ts lib/properties.ts lib/image-url.test.ts
git commit -m "feat(images): serve absolute (uploaded) image URLs verbatim"
```

---

## Task 3: Storage bucket migration

**Files:**
- Create: `supabase/migrations/0029_catalog_images_bucket.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 0029_catalog_images_bucket.sql
-- Public Storage bucket for admin-uploaded catalog images. Reads are public
-- (CDN-served); writes happen only through the service-role admin action.
insert into storage.buckets (id, name, public)
values ('catalog-images', 'catalog-images', true)
on conflict (id) do nothing;
```

- [ ] **Step 2: Apply to the GT Vault project**

Apply via the Supabase MCP `apply_migration` (project_id `bzoizaakcqzlvpraysjn`, name `0029_catalog_images_bucket`). If it errors with a permissions problem on `storage.buckets`, STOP and report — the fallback is to create the bucket via the Storage API/dashboard (named `catalog-images`, public), but try the SQL first.

- [ ] **Step 3: Verify (non-destructive)**

Run via MCP `execute_sql` (project `bzoizaakcqzlvpraysjn`):
```sql
select id, public from storage.buckets where id = 'catalog-images';
```
Expected: one row, `public = true`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0029_catalog_images_bucket.sql
git commit -m "feat(images): public catalog-images storage bucket"
```

---

## Task 4: Upload/remove actions + next.config

**Files:**
- Modify: `app/admin/actions.ts`
- Modify: `next.config.ts`

- [ ] **Step 1: Append the actions to `app/admin/actions.ts`**

Add this import near the top with the other imports:
```ts
import { validateImageFile, storageKey, publicImageUrl, type ImageEntity } from "@/lib/admin/image-upload";
```
Append at the END of the file:
```ts
const IMAGE_ENTITIES = new Set<ImageEntity>(["vehicles", "properties"]);

export type ImageResult = { ok: true; url: string | null } | { error: string };

/** Upload/replace a catalog item's image. Stores an absolute Storage URL in image_path. */
export async function uploadCatalogImage(
  entity: string,
  id: string,
  formData: FormData,
): Promise<ImageResult> {
  await requireAdmin();
  if (!IMAGE_ENTITIES.has(entity as ImageEntity)) return { error: "Invalid entity." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "No file provided." };

  const v = validateImageFile({ type: file.type, size: file.size });
  if (!v.ok) return { error: v.error };

  const key = storageKey(entity as ImageEntity, id);
  const bytes = new Uint8Array(await file.arrayBuffer());

  const supabase = createAdminClient();
  const { error: upErr } = await supabase.storage
    .from("catalog-images")
    .upload(key, bytes, { upsert: true, contentType: file.type });
  if (upErr) return { error: upErr.message };

  const url = `${publicImageUrl(key)}?t=${Date.now()}`;
  const { error } = await supabase.from(entity).update({ image_path: url }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(`/admin/${entity}`);
  revalidatePath("/", "layout");
  return { ok: true, url };
}

/** Clear a catalog item's image. */
export async function removeCatalogImage(entity: string, id: string): Promise<ImageResult> {
  await requireAdmin();
  if (!IMAGE_ENTITIES.has(entity as ImageEntity)) return { error: "Invalid entity." };

  const supabase = createAdminClient();
  const { error } = await supabase.from(entity).update({ image_path: null }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(`/admin/${entity}`);
  revalidatePath("/", "layout");
  return { ok: true, url: null };
}
```

- [ ] **Step 2: Add the Supabase remote pattern to `next.config.ts`**

Change the `remotePatterns` array:
```ts
    remotePatterns: [
      { protocol: "https", hostname: "static.wikia.nocookie.net" },
    ],
```
to:
```ts
    remotePatterns: [
      { protocol: "https", hostname: "static.wikia.nocookie.net" },
      { protocol: "https", hostname: "*.supabase.co" },
    ],
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/admin/actions.ts next.config.ts
git commit -m "feat(admin): catalog image upload/remove actions + supabase image host"
```

---

## Task 5: Image cell + wire into both editors

**Files:**
- Create: `app/admin/admin-image-cell.tsx`
- Modify: `app/admin/vehicles/page.tsx`
- Modify: `app/admin/vehicles/admin-vehicles-table.tsx`
- Modify: `app/admin/properties/page.tsx`
- Modify: `app/admin/properties/admin-properties-table.tsx`

- [ ] **Step 1: Create the shared image cell**

```tsx
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
```

- [ ] **Step 2: Vehicles — carry `image_path` to the table**

In `app/admin/vehicles/page.tsx`:
- Add `image_path` to the select string: change
  `"id, display_name, class, manufacturer_id, price, availability, vendors, manufacturers(display)"`
  to
  `"id, display_name, class, manufacturer_id, price, availability, vendors, image_path, manufacturers(display)"`.
- In the mapped row object, add `image_path: r.image_path,` (after `vendors: ...`).

In `app/admin/vehicles/admin-vehicles-table.tsx`:
- Add `image_path: string | null;` to the `AdminVehicleRow` type.
- Add the imports:
  ```tsx
  import { vehicleImageUrl } from "@/lib/vehicles";
  import { AdminImageCell } from "../admin-image-cell";
  ```
- Add an `<th className="w-44 p-2">Image</th>` as the FIRST header cell (before `Name`).
- In `Row`, add a FIRST `<td>` before the Name cell:
  ```tsx
      <td className="p-1.5">
        <AdminImageCell entity="vehicles" id={row.id} initialUrl={vehicleImageUrl(row.image_path)} />
      </td>
  ```

- [ ] **Step 3: Properties — carry `image_path` to the table**

In `app/admin/properties/page.tsx`:
- Add `image_path` to the select string: change
  `"id, display_name, property_type, subtype, subtype_display, neighborhood, capacity, counts_as_garage, price"`
  to
  `"id, display_name, property_type, subtype, subtype_display, neighborhood, capacity, counts_as_garage, price, image_path"`.
  (The `as AdminPropertyRow[]` cast still holds once the type has `image_path`.)

In `app/admin/properties/admin-properties-table.tsx`:
- Add `image_path: string | null;` to the `AdminPropertyRow` type.
- Add the imports:
  ```tsx
  import { propertyImageUrl } from "@/lib/properties";
  import { AdminImageCell } from "../admin-image-cell";
  ```
- Add an `<th className="w-44 p-2">Image</th>` as the FIRST header cell (before `Name`).
- In `Row`, add a FIRST `<td>` before the Name cell:
  ```tsx
      <td className="p-1.5">
        <AdminImageCell entity="properties" id={row.id} initialUrl={propertyImageUrl(row.image_path)} />
      </td>
  ```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Full test suite**

Run: `npm test`
Expected: all green, including `lib/admin/image-upload.test.ts` and `lib/image-url.test.ts`.

- [ ] **Step 6: Manual smoke (note — needs a browser + the live bucket)**

As the owner: `/admin/vehicles` and `/admin/properties` show an Image column with a thumbnail + Replace/Remove. Replace a vehicle image with a small PNG → it uploads, the thumbnail updates, and the image shows on the public `/vehicles` card (cache-busted). Try a >5 MB or non-image file → clear error, no change. Remove → thumbnail clears. A legacy (un-replaced) image still renders. (Do not block the commit on this step.)

- [ ] **Step 7: Commit**

```bash
git add app/admin/admin-image-cell.tsx app/admin/vehicles/page.tsx app/admin/vehicles/admin-vehicles-table.tsx app/admin/properties/page.tsx app/admin/properties/admin-properties-table.tsx
git commit -m "feat(admin): image Replace/Remove column in vehicle + property editors"
```

---

## Self-Review Notes (for the executor)

- **Spec coverage:** Storage bucket (Task 3), no-schema `image_path` overload + helper passthrough (Task 2), validation 5 MB/type (Task 1), upload/replace/remove actions service-role (Task 4), cache-bust `?t=` (Task 4), next/image host (Task 4), Replace/Remove UI on vehicles + properties incl. businesses (Task 5), legacy images unaffected (Task 2 passthrough only triggers on `http`).
- **Type consistency:** `ImageEntity` defined once in `lib/admin/image-upload.ts` and imported by the actions + cell; `ImageResult` `{ ok: true; url: string | null } | { error }` consistent between upload/remove and the cell's `setUrl(res.url)`.
- **Orphan-free:** extension-less stable key `{entity}/{id}` + `upsert` → one object per item; re-uploads overwrite.
- **Admin thumbnail uses a plain `<img>`** (no next/image), so it works regardless of the remote-pattern config; public pages use `next/image` and rely on the Task-4 `*.supabase.co` pattern.
- **Deferred per spec:** resizing/optimization, migrating the 1,016 legacy files, upgrades imagery, draft/publish (5c), activity log (5b).
