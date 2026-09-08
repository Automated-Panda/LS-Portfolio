// READ-ONLY. Does migration 0050's backfill actually have work to do?
import { createClient } from "@supabase/supabase-js";
async function main() {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false } });
  for (const t of ["user_owned_vehicles", "user_owned_properties", "organizer_plans", "conversations"]) {
    const { count: nulls, error } = await db.from(t).select("id", { count: "exact", head: true }).is("character_id", null);
    if (error) { console.log(`${t.padEnd(24)} ERROR ${error.message}`); continue; }
    const { count: total } = await db.from(t).select("id", { count: "exact", head: true });
    console.log(`${t.padEnd(24)} character_id IS NULL: ${String(nulls ?? 0).padStart(5)}  / ${total} rows`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
