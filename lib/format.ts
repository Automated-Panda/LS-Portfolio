/** Shared money formatters for GTA$ values across the app. */

const COMPACT = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
  style: "currency",
  currency: "USD",
});

const FULL = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

/** Compact GTA$ ($1.2M / $250K / $1,200). Use for cards + headlines. */
export function formatMoneyCompact(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "—";
  if (amount === 0) return "$0";
  return COMPACT.format(amount);
}

/** Full GTA$ with thousands separators ($1,200,000). Use for tooltips + detail views. */
export function formatMoneyFull(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "—";
  return FULL.format(amount);
}
