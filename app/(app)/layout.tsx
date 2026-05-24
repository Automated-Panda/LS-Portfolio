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

  const { headers } = await import("next/headers");
  const pathname = (await headers()).get("x-pathname") ?? "";
  const { isWizardCompleted } = await import("@/lib/queries/wizard");
  const completed = await isWizardCompleted(user.id);
  if (!completed && pathname !== "/wizard" && pathname !== "/dashboard") {
    redirect("/wizard");
  }

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
