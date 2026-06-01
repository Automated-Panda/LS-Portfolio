// scripts/credits-check.ts
// Prints a user's credit buckets straight from the DB, applying lazy
// normalization. Usage: npm run credits:check -- <userId or email>
import { createAdminClient } from "@/lib/supabase/admin";
import { getCreditState } from "@/lib/credits/server";

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error("Usage: npm run credits:check -- <userId or email>");
    process.exit(1);
  }

  const supabase = createAdminClient();

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

  const { state, total } = await getCreditState(userId);
  console.log(`\nCredits for ${userId}:`);
  console.log(`  free_monthly    : ${state.freeMonthly}`);
  console.log(`  sub_monthly     : ${state.subMonthly}`);
  console.log(`  balance_credits : ${state.balanceCredits}`);
  console.log(`  has_active_sub  : ${state.hasActiveSub}`);
  console.log(`  ─────────────────────────`);
  console.log(`  TOTAL           : ${total}\n`);
}

main().catch((err) => {
  console.error("✗ credits-check failed:", err.message ?? err);
  process.exit(1);
});
