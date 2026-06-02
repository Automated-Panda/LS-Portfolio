// lib/credits/adjust.ts
// Pure parsing/validation of an admin-entered signed credit amount.

export type AdjustParse = { ok: true; delta: number } | { ok: false; error: string };

const MAX = 1_000_000;

export function parseCreditDelta(input: string): AdjustParse {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: "Enter an amount." };
  const n = Number(trimmed);
  if (!Number.isInteger(n)) return { ok: false, error: "Amount must be a whole number." };
  if (n === 0) return { ok: false, error: "Amount can't be zero." };
  if (Math.abs(n) > MAX) return { ok: false, error: "That amount is too large." };
  return { ok: true, delta: n };
}
