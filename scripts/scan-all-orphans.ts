// READ-ONLY. Account-wide scan: who else has cars unparked but still holding a
// floor/bay breadcrumb (the fingerprint of the cross-character delete bug)?
import { createClient } from "@supabase/supabase-js";

async function main() {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // PostgREST caps a response at 1000 rows - page explicitly or the scan
  // silently truncates and under-reports who is affected.
  type Car = { id: string; user_id: string; character_id: string | null; assigned_upgrade_id: string | null; slot_number: number | null };
  const cars: Car[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from("user_owned_vehicles")
      .select("id, user_id, character_id, assigned_upgrade_id, slot_number")
      .is("stored_in_property_id", null).is("stored_in_vehicle_id", null)
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    cars.push(...((data ?? []) as Car[]));
    if ((data ?? []).length < PAGE) break;
  }
  console.log(`scanned ${cars.length} unparked vehicle rows
`);

  const byUser = new Map<string, { upgrade: number; slotOnly: number }>();
  for (const c of cars) {
    if (!c.assigned_upgrade_id && c.slot_number === null) continue;
    const k = c.user_id as string;
    if (!byUser.has(k)) byUser.set(k, { upgrade: 0, slotOnly: 0 });
    if (c.assigned_upgrade_id) byUser.get(k)!.upgrade++; else byUser.get(k)!.slotOnly++;
  }

  const { data: users } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const emailOf = new Map((users?.users ?? []).map((u) => [u.id, u.email ?? "?"]));

  // How many characters does each affected account have?
  const { data: chars } = await db.from("characters").select("user_id");
  const charCount = new Map<string, number>();
  for (const c of chars ?? []) charCount.set(c.user_id as string, (charCount.get(c.user_id as string) ?? 0) + 1);

  console.log("affected accounts (unparked cars still holding a placement breadcrumb):\n");
  const rows = [...byUser].sort((a, b) => (b[1].upgrade + b[1].slotOnly) - (a[1].upgrade + a[1].slotOnly));
  for (const [uid, n] of rows)
    console.log(`  ${(emailOf.get(uid) ?? uid).padEnd(38)} chars=${charCount.get(uid) ?? 0}  restorable=${String(n.upgrade).padStart(4)}  slot-only=${String(n.slotOnly).padStart(4)}`);
  console.log(`\ntotal accounts with any breadcrumb: ${rows.length}`);
  console.log(`total accounts with >1 character:    ${[...charCount.values()].filter((v) => v > 1).length}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
