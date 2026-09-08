// READ-ONLY. The cars whose only breadcrumb is a slot number. Slots are unique
// per garage, so colliding slots prove separate garages. Greedy-buckets them
// into the minimum number of garages and prints a list to send the user.
import { createClient } from "@supabase/supabase-js";

async function main() {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const arg = process.argv[2];
  const { data: users } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const u = users.users.find((x) => x.email?.toLowerCase() === arg.toLowerCase())!;
  const { data: prof } = await db.from("profiles").select("active_character_id").eq("id", u.id).maybeSingle();

  const { data: cars } = await db.from("user_owned_vehicles")
    .select("id, vehicle_id, nickname, slot_number, created_at, vehicles!inner(display_name, class)")
    .eq("character_id", prof!.active_character_id as string)
    .is("stored_in_property_id", null).is("stored_in_vehicle_id", null)
    .is("assigned_upgrade_id", null).not("slot_number", "is", null)
    .order("created_at", { ascending: true });

  type Car = { id: string; vehicle_id: string; nickname: string | null; slot_number: number; created_at: string; vehicles: { display_name: string; class: string } };
  const list = (cars ?? []) as unknown as Car[];

  // Greedy bucketing: a car joins the first bucket that has not used its slot.
  const buckets: Car[][] = [];
  for (const c of list) {
    let placed = false;
    for (const b of buckets) {
      if (!b.some((x) => x.slot_number === c.slot_number)) { b.push(c); placed = true; break; }
    }
    if (!placed) buckets.push([c]);
  }

  console.log(`${list.length} cars, no floor/bay recorded - only a slot number.`);
  console.log(`Slot collisions prove AT LEAST ${buckets.length} separate garages.\n`);
  buckets.forEach((b, i) => {
    b.sort((x, y) => x.slot_number - y.slot_number);
    const slots = b.map((c) => c.slot_number);
    console.log(`--- Garage ${i + 1}: ${b.length} cars, slots ${Math.min(...slots)}-${Math.max(...slots)} (needs capacity >= ${Math.max(...slots)})`);
    for (const c of b)
      console.log(`    slot ${String(c.slot_number).padStart(2)}  ${c.vehicles.display_name.padEnd(24)} ${c.nickname ? `"${c.nickname}" ` : ""}[${c.vehicles.class}]  added ${c.created_at.slice(0, 10)}`);
    console.log();
  });
}
main().catch((e) => { console.error(e); process.exit(1); });
