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
