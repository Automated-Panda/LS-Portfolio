import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vehicles")
    .select("id, display_name, class, manufacturers(display)")
    .order("display_name", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  type Row = NonNullable<typeof data>[number];
  return NextResponse.json(
    (data ?? []).map((r: Row) => {
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
