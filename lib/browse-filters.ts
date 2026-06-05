// Shared price-range filtering + sorting for the catalogue browse pages
// (/vehicles, /properties, /businesses). Client-safe — no server imports.

export type PricedItem = { price: number | null; display_name: string };

/**
 * Whether an item's price falls within [pmin, pmax]. Unpriced (null) items are
 * EXCLUDED whenever a bound is set — they can't be placed in a numeric range.
 */
export function priceMatches(
  price: number | null,
  pmin: number | null,
  pmax: number | null,
): boolean {
  if (pmin === null && pmax === null) return true;
  if (price === null) return false;
  if (pmin !== null && price < pmin) return false;
  if (pmax !== null && price > pmax) return false;
  return true;
}

/** Parse a `pmin`/`pmax` search param into a number or null. */
export function priceParam(value: string | null): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Return a sorted copy per the `sort` param. Unpriced items always sort to the
 * end for price sorts (so a null price never looks like "cheapest"/"priciest").
 */
export function sortByParam<T extends PricedItem>(items: T[], sort: string): T[] {
  if (sort === "default") return items;
  const out = [...items];
  if (sort === "name") {
    out.sort((a, b) => a.display_name.localeCompare(b.display_name));
    return out;
  }
  const dir = sort === "price-desc" ? -1 : 1;
  out.sort((a, b) => {
    if (a.price === null && b.price === null) return 0;
    if (a.price === null) return 1; // nulls last
    if (b.price === null) return -1;
    return (a.price - b.price) * dir;
  });
  return out;
}
