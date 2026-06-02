# Admin Dashboard — Slice 5a: Catalog Image Upload / Replace

**Date:** 2026-06-02
**Status:** Approved (design)
**Author:** James + Claude

## Context

Slice 5 of the Admin Dashboard roadmap ("content-mgmt upgrades") is really three
independent features — **image upload**, **draft/publish**, and an **activity
log**. They are being built as separate sub-slices. This spec is **5a: image
upload/replace**, chosen first (highest practical value; admins cannot manage
images at all today).

Current state (verified):
- Catalog imagery is ~1,016 static `.webp` files in `public/vehicles/` and
  `public/properties/`, published from `data/images/**` by
  `scripts/publish-images.mjs`.
- `vehicles.image_path` / `properties.image_path` hold a legacy reference; the
  helpers `vehicleImageUrl` (`lib/vehicles.ts`) and `propertyImageUrl`
  (`lib/properties.ts`) take that path and return `/vehicles|properties/{basename}`.
- **No Supabase Storage** is configured. Admin editors edit text fields only — no
  image editing.
- "Businesses" are `properties` rows with `property_type = 'business'` — same
  image handling as any property.
- Runtime writes to `public/` do NOT persist in production (serverless/ephemeral
  FS), so uploads must go to Storage.

## Goals

- An admin can **upload/replace** the image of any vehicle or property (incl.
  businesses) from the existing admin editors, and **remove** it.
- Uploaded images are stored in **Supabase Storage** and served via its CDN.
- Existing static images keep working unchanged; **no migration** of the 1,016
  files.

## Non-Goals (deferred)

- Server-side resizing/optimization (`next/image` optimizes on serve).
- Migrating existing static images into Storage.
- Upgrades imagery (upgrades have no images); bulk upload; image cropping.
- Draft/publish (5c) and activity log (5b).

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Where uploads live | Supabase Storage public bucket `catalog-images` | Persists in production; free CDN |
| Schema change | **None** — overload `image_path` | An uploaded image stores an absolute `https://…` URL; legacy rows keep a basename. Zero caller changes. |
| Helper behavior | absolute URL → return as-is; else legacy `/…/{basename}` | One-line branch; pure + testable |
| Write auth | Service-role client in `requireAdmin` action | Same pattern as all admin writes; no storage RLS policies needed |
| Cache-bust | append `?t={timestamp}` to the stored URL | Stable object key + upsert would otherwise serve a stale CDN copy |
| Scope | vehicles + properties only | Upgrades have no images |

## Architecture

### 1. Storage — migration `0029_catalog_images_bucket.sql`

```sql
insert into storage.buckets (id, name, public)
values ('catalog-images', 'catalog-images', true)
on conflict (id) do nothing;
```

Public bucket → objects are world-readable by their public URL (good for serving).
Uploads go through the service-role admin client (bypasses RLS), so no custom
`storage.objects` policies are required. (If a later sub-slice needs
authenticated-only buckets, that's separate.)

### 2. Pure helpers

- `lib/vehicles.ts` `vehicleImageUrl(imagePath)` and `lib/properties.ts`
  `propertyImageUrl(imagePath)` — add a leading branch:
  ```ts
  if (imagePath && /^https?:\/\//.test(imagePath)) return imagePath;
  ```
  then the existing basename logic. (Null → null unchanged.)
- New `lib/admin/image-upload.ts` (pure, no I/O):
  - `IMAGE_TYPES = ['image/webp','image/png','image/jpeg']`, `MAX_IMAGE_BYTES = 5*1024*1024`.
  - `validateImageFile({ type, size }): { ok: true; ext: string } | { ok: false; error: string }`
    — rejects disallowed type / oversized / empty; returns the extension
    (`webp|png|jpg`) for the storage key.
  - `storageKey(entity: 'vehicles'|'properties', id: string, ext: string): string`
    → `${entity}/${id}.${ext}`.
  - `publicImageUrl(key: string): string` → builds
    `${NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/catalog-images/${key}`.

### 3. Admin actions — append to `app/admin/actions.ts`

- `uploadCatalogImage(entity, id, formData): Promise<Result>` (`requireAdmin`):
  - read `formData.get('file')` as a `File`; if absent → error.
  - `validateImageFile({ type, size })`; on fail → its error.
  - `key = storageKey(entity, id, ext)`; `bytes = new Uint8Array(await file.arrayBuffer())`.
  - `createAdminClient().storage.from('catalog-images').upload(key, bytes, { upsert: true, contentType: type })`; on error → error.
  - `url = publicImageUrl(key) + '?t=' + Date.now()`.
  - update the row (`vehicles` or `properties`) `image_path = url`.
  - `revalidatePath('/admin/' + section)`; `revalidatePath('/', 'layout')`.
  - `entity` is validated against `('vehicles','properties')`.
- `removeCatalogImage(entity, id): Promise<Result>` (`requireAdmin`): set
  `image_path = null`, revalidate.

### 4. Admin UI

- Add an **Image** column to `app/admin/vehicles/admin-vehicles-table.tsx` and
  `app/admin/properties/admin-properties-table.tsx`: a small `<img>` thumbnail of
  the current image (via the URL helper), a **Replace** button (hidden
  `<input type="file" accept="image/*">` triggered by the button), and a
  **Remove** link. On file selection: build `FormData`, call
  `uploadCatalogImage`, show an uploading state (`useTransition`), surface errors
  inline. A shared small client component (e.g. `admin-image-cell.tsx`) avoids
  duplicating the logic across both tables.

### 5. `next.config.ts`

Add a `remotePatterns` entry for the Supabase Storage host so `next/image` will
serve uploaded images:
```ts
{ protocol: 'https', hostname: '*.supabase.co' }
```
(Keep the existing patterns.)

### 6. Testing (TDD on pure logic)

`lib/admin/image-upload.test.ts`:
- `validateImageFile`: accepts webp/png/jpeg under the cap (returns the right
  `ext`); rejects an unknown type, an oversized file, and a zero-byte file.
- `storageKey`: `storageKey('vehicles','abc','webp') === 'vehicles/abc.webp'`.
- `publicImageUrl`: contains the bucket + key (env-based prefix).

Extend the existing image-helper tests (or add):
`vehicleImageUrl`/`propertyImageUrl` return an absolute URL verbatim, build the
legacy path for a basename, and return null for null.

The upload/remove actions, the UI cell, the bucket migration, and the
`next.config` change are verified by typecheck + manual smoke.

## Acceptance Criteria

- [ ] In `/admin/vehicles` and `/admin/properties`, each row shows the current
      image (or a placeholder) with Replace + Remove controls.
- [ ] Replacing uploads to Supabase Storage and the new image appears in the admin
      table AND on the public catalog/detail pages (cache-busted) for all users.
- [ ] Uploading a non-image or a >5 MB file shows a clear error and does not change
      the row.
- [ ] Remove clears the image (row shows the placeholder).
- [ ] Existing static catalog images (legacy `image_path`) continue to render
      unchanged.
- [ ] A business (`property_type='business'`) image can be replaced via the
      properties editor.
- [ ] `npm run typecheck` and `npm test` pass (incl. the new image-upload + helper
      tests).
