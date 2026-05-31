"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { updateProfileAction, type ProfileState } from "./actions";

type Props = {
  email: string;
  username: string;
  displayName: string;
  gtaPlus: boolean;
};

export function ProfileForm({ email, username, displayName, gtaPlus }: Props) {
  const [state, formAction, isPending] = useActionState<ProfileState, FormData>(
    updateProfileAction,
    {},
  );

  useEffect(() => {
    if (state.success) {
      toast.success("Profile updated.");
    }
  }, [state.success]);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" value={email} disabled readOnly />
      </div>

      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          name="username"
          type="text"
          defaultValue={username}
          pattern="[a-zA-Z0-9_\-]+"
          minLength={3}
          maxLength={30}
          required
        />
        {state.fieldErrors?.username && (
          <p className="text-sm text-destructive">
            {state.fieldErrors.username}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="displayName">Display name</Label>
        <Input
          id="displayName"
          name="displayName"
          type="text"
          defaultValue={displayName}
          maxLength={60}
          placeholder="Optional"
        />
        {state.fieldErrors?.displayName && (
          <p className="text-sm text-destructive">
            {state.fieldErrors.displayName}
          </p>
        )}
      </div>

      <div className="flex items-start gap-3 rounded-md border p-3">
        <input
          id="gtaPlus"
          name="gtaPlus"
          type="checkbox"
          defaultChecked={gtaPlus}
          className="mt-1 h-4 w-4 accent-[#84cc16]"
        />
        <div className="space-y-0.5">
          <Label htmlFor="gtaPlus">GTA+ member</Label>
          <p className="text-xs text-muted-foreground">
            Unlocks GTA+ perks — e.g. the larger McKenzie hangar boost (+20 vs +15 aircraft slots).
          </p>
        </div>
      </div>

      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
