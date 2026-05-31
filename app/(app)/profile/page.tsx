import { redirect } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { getUserHighlights } from "@/lib/queries/highlights";

import { DangerZone } from "./danger-zone";
import { ManageHighlights } from "./manage-highlights";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: profile }, highlights] = await Promise.all([
    supabase
      .from("profiles")
      .select("username, display_name, gta_plus")
      .eq("id", user.id)
      .maybeSingle(),
    getUserHighlights(user.id),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Profile</h1>
        <p className="text-sm text-muted-foreground">
          Your public identity inside GT Vault.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>
            Your username is visible to anyone you share your portfolio with.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm
            email={user.email ?? ""}
            username={profile?.username ?? ""}
            displayName={profile?.display_name ?? ""}
            gtaPlus={profile?.gta_plus ?? false}
          />
        </CardContent>
      </Card>

      <ManageHighlights highlights={highlights} />

      <DangerZone />
    </div>
  );
}
