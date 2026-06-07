import { redirect } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { getScope } from "@/lib/scope";
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
  const characterId = (await getScope())!.characterId;

  const [{ data: profile }, highlights] = await Promise.all([
    supabase
      .from("profiles")
      .select("username, display_name")
      .eq("id", user.id)
      .maybeSingle(),
    getUserHighlights(characterId),
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
          />
        </CardContent>
      </Card>

      <ManageHighlights highlights={highlights} />

      <DangerZone />
    </div>
  );
}
