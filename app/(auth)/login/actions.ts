"use server";

import { redirect } from "next/navigation";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  identifier: z.string().min(1, "Enter your email or username."),
  password: z.string().min(1, "Password is required."),
  next: z.string().optional(),
});

export type LoginState = {
  error?: string;
  fieldErrors?: Partial<Record<"identifier" | "password", string>>;
};

/**
 * Resolve a username to its email by using the service-role admin client.
 * `profiles.username` is publicly SELECT-able (RLS allows it) but `auth.users`
 * isn't, so we go through `auth.admin.getUserById` to read the email.
 */
async function emailForUsername(username: string): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;

  const admin = createAdminClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();
  if (!profile) return null;

  const { data: userRes } = await admin.auth.admin.getUserById(profile.id);
  return userRes.user?.email ?? null;
}

export async function logInAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    identifier: formData.get("identifier"),
    password: formData.get("password"),
    next: formData.get("next") || undefined,
  });

  if (!parsed.success) {
    const fieldErrors: LoginState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (field === "identifier" || field === "password") {
        fieldErrors[field] = issue.message;
      }
    }
    return { fieldErrors };
  }

  const { identifier, password, next } = parsed.data;
  const looksLikeEmail = identifier.includes("@");
  const email = looksLikeEmail
    ? identifier
    : await emailForUsername(identifier);

  if (!email) {
    return { error: "Invalid email/username or password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: "Invalid email/username or password." };
  }

  redirect(next || "/dashboard");
}
