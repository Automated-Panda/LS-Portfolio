import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell/app-shell";
import { getOwnedCounts } from "@/lib/queries/vehicles";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Note: the prior wizard-redirect (force /wizard if isWizardCompleted=false
  // on any route except /dashboard or /wizard) has been removed. The Phase 6
  // EmptyDashboard now handles first-login onboarding with its own wizard
  // CTA + browse paths, so the layout-level bouncer was breaking sidebar nav
  // and EmptyDashboard's "Browse all vehicles/properties" CTAs for any user
  // in a partial-onboarding state. Users still reach /wizard via the
  // EmptyDashboard hero or manual navigation.

  const [{ data: profile }, counts] = await Promise.all([
    supabase
      .from("profiles")
      .select("username, display_name")
      .eq("id", user.id)
      .maybeSingle(),
    getOwnedCounts(user.id),
  ]);

  return (
    <AppShell
      email={user.email ?? ""}
      username={profile?.username ?? null}
      displayName={profile?.display_name ?? null}
      counts={counts}
    >
      {children}
    </AppShell>
  );
}
