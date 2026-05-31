"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters.")
    .max(30, "Username must be 30 characters or fewer.")
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      "Letters, numbers, underscores, and hyphens only.",
    ),
  displayName: z
    .string()
    .max(60, "Display name must be 60 characters or fewer.")
    .optional(),
  gtaPlus: z.boolean(),
});

export type ProfileState = {
  success?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<"username" | "displayName", string>>;
};

export async function updateProfileAction(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const parsed = schema.safeParse({
    username: formData.get("username"),
    displayName: formData.get("displayName") || undefined,
    gtaPlus: formData.get("gtaPlus") === "on",
  });

  if (!parsed.success) {
    const fieldErrors: ProfileState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (field === "username" || field === "displayName") {
        fieldErrors[field] = issue.message;
      }
    }
    return { fieldErrors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not signed in." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      username: parsed.data.username,
      display_name: parsed.data.displayName ?? null,
      gta_plus: parsed.data.gtaPlus,
    })
    .eq("id", user.id);

  if (error) {
    if (error.code === "23505") {
      return { fieldErrors: { username: "That username is taken." } };
    }
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  return { success: true };
}
