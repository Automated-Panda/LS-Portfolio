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
