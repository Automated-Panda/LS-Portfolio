// lib/stripe/metadata.ts
/** Read the authoritative credit count from a Stripe metadata bag. Throws if absent/invalid. */
export function creditsFromMetadata(
  metadata: Record<string, string> | null | undefined,
): number {
  const raw = metadata?.credits;
  const n = raw != null ? Number.parseInt(raw, 10) : NaN;
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`Invalid credits metadata: ${JSON.stringify(raw)}`);
  }
  return n;
}
