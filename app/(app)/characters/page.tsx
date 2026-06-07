// app/(app)/characters/page.tsx
import { redirect } from "next/navigation";

import { getCharacterSwitcherData } from "@/lib/queries/characters";

import { CharactersManager } from "./characters-manager";

export default async function CharactersPage() {
  const data = await getCharacterSwitcherData();
  if (!data) redirect("/login");

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profiles &amp; Characters</h1>
        <p className="text-sm text-muted-foreground">
          Each <strong>Profile</strong> is a GTA account (with its own GTA+); each holds up to
          2 <strong>Characters</strong> that own their own vehicles &amp; properties.
        </p>
      </div>
      <CharactersManager data={data} />
    </div>
  );
}
