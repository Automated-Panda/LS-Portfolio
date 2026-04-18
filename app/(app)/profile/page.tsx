import { redirect } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

import { ProfileForm } from "./profile-form";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Profile</h1>
        <p className="text-sm text-muted-foreground">
          Your public identity inside LS Portfolio.
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
    </div>
  );
}
