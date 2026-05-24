import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  getActiveUndoablePlan,
  getRecentPlans,
} from "@/lib/queries/organizer";

import { OrganizeChat } from "./organize-chat";

export default async function OrganizePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [initialPlans, initialUndoablePlan] = await Promise.all([
    getRecentPlans(user.id),
    getActiveUndoablePlan(user.id),
  ]);

  return (
    <OrganizeChat
      initialPlans={initialPlans}
      initialUndoablePlan={initialUndoablePlan}
    />
  );
}
