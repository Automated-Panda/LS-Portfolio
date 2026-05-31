import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  getActiveUndoablePlan,
  getConversations,
} from "@/lib/queries/organizer";

import { OrganizeChat } from "./organize-chat";

export default async function OrganizePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [initialConversations, initialUndoablePlan] = await Promise.all([
    getConversations(user.id),
    getActiveUndoablePlan(user.id),
  ]);

  return (
    <OrganizeChat
      initialConversations={initialConversations}
      initialUndoablePlan={initialUndoablePlan}
    />
  );
}
