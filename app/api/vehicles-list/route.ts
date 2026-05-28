import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vehicles")
    .select("id, internal_name, display_name, class, manufacturers(display)")
    .order("display_name", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  type Row = NonNullable<typeof data>[number];
  const rows = data ?? [];

  // Fold out drift handling variants exactly like the /vehicles browser
  // (lib/queries/vehicles.ts): a drift variant (internal_name starts with
  // "drift") collapses into the base vehicle sharing its display_name, so the
  // picker lists e.g. "Cypher" once instead of twice.
  const isDrift = (r: Row) =>
    (r.internal_name ?? "").toLowerCase().startsWith("drift");
  const byDisplay = new Map<string, Row[]>();
  for (const r of rows) {
    const arr = byDisplay.get(r.display_name) ?? [];
    arr.push(r);
    byDisplay.set(r.display_name, arr);
  }
  const driftIds = new Set<string>();
  for (const [, group] of byDisplay) {
    const hasBase = group.some((r) => !isDrift(r));
    if (!hasBase) continue;
    for (const r of group) if (isDrift(r)) driftIds.add(r.id);
  }

  return NextResponse.json(
    rows
      .filter((r: Row) => !driftIds.has(r.id))
      .map((r: Row) => {
        const m = Array.isArray(r.manufacturers) ? r.manufacturers[0] : r.manufacturers;
        return {
          id: r.id,
          display_name: r.display_name,
          class: r.class,
          manufacturer_display: m?.display ?? "",
        };
      }),
  );
}
