import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getScope } from "@/lib/scope";
import {
  getActiveUndoablePlan,
  getConversations,
} from "@/lib/queries/organizer";
import { organizerBalance } from "@/lib/credits/gate";

import { OrganizeChat } from "./organize-chat";

export default async function OrganizePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const characterId = (await getScope())!.characterId;

  const [initialConversations, initialUndoablePlan, initialBalance] = await Promise.all([
    getConversations(characterId),
    getActiveUndoablePlan(characterId),
    organizerBalance(user.id, user.email),
  ]);

  return (
    <OrganizeChat
      initialConversations={initialConversations}
      initialUndoablePlan={initialUndoablePlan}
      initialBalance={initialBalance}
    />
  );
}
