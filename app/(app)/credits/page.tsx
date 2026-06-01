import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { organizerBalance } from "@/lib/credits/gate";

import { CreditsView } from "./credits-view";

export default async function CreditsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [balance, { data: row }] = await Promise.all([
    organizerBalance(user.id, user.email),
    supabase
      .from("user_credits")
      .select("has_active_sub, stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  return (
    <CreditsView
      balance={balance}
      hasActiveSub={Boolean(row?.has_active_sub)}
      hasBillingAccount={Boolean(row?.stripe_customer_id)}
    />
  );
}
