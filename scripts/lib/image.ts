import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";

export async function downloadAndNormalize(
  imageUrl: string,
  outPath: string,
  width = 600,
): Promise<void> {
  const res = await fetch(imageUrl, {
    headers: { "User-Agent": "LSGarageManager-seed/0.1 (personal project)" },
  });
  if (!res.ok) {
    throw new Error(`Image fetch failed ${res.status} for ${imageUrl}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await sharp(buf)
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: 85 })
    .toFile(outPath);
}
