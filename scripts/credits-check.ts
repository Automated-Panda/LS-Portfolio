// scripts/credits-check.ts
// Prints a user's credit buckets straight from the DB, applying lazy
// normalization (read-only — does NOT persist). Usage:
//   npm run credits:check -- <userId or email>
//
// Builds its own service-role Supabase client (like scripts/import-seed.ts)
// rather than importing lib/supabase/admin.ts or lib/credits/server.ts, which
// are `server-only` and throw under plain `tsx`/Node. Only the pure logic and
// row mapper are imported.
import { createClient } from "@supabase/supabase-js";
import { normalize, totalBalance } from "@/lib/credits/logic";
import { rowToState, type UserCreditsRow } from "@/lib/credits/types";

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error("Usage: npm run credits:check -- <userId or email>");
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      "✗ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY must be set in .env.local",
    );
    process.exit(1);
  }
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Resolve email → user id if an email was passed.
  let userId = arg;
  if (arg.includes("@")) {
    const { data, error } = await supabase.auth.admin.listUsers();
    if (error) throw new Error(error.message);
    const found = data.users.find((u) => u.email?.toLowerCase() === arg.toLowerCase());
    if (!found) {
      console.error(`No user with email ${arg}`);
      process.exit(1);
    }
    userId = found.id;
  }

  const { data: row, error } = await supabase
    .from("user_credits")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) {
    console.error(`No user_credits row for ${userId}`);
    process.exit(1);
  }

  const state = normalize(rowToState(row as UserCreditsRow), Date.now());
  console.log(`\nCredits for ${userId}:`);
  console.log(`  free_monthly    : ${state.freeMonthly}`);
  console.log(`  sub_monthly     : ${state.subMonthly}`);
  console.log(`  balance_credits : ${state.balanceCredits}`);
  console.log(`  has_active_sub  : ${state.hasActiveSub}`);
  console.log(`  ─────────────────────────`);
  console.log(`  TOTAL           : ${totalBalance(state)}\n`);
}

main().catch((err) => {
  console.error("✗ credits-check failed:", err.message ?? err);
  process.exit(1);
});
