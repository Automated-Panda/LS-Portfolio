"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const signupSchema = z.object({
  email: z.string().email("Enter a valid email."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters.")
    .max(30, "Username must be 30 characters or fewer.")
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      "Letters, numbers, underscores, and hyphens only.",
    ),
});

export type SignupState = {
  error?: string;
  fieldErrors?: Partial<Record<"email" | "password" | "username", string>>;
};

async function getOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function signUpAction(
  _prev: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const parsed = signupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    username: formData.get("username"),
  });

  if (!parsed.success) {
    const fieldErrors: SignupState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (field === "email" || field === "password" || field === "username") {
        fieldErrors[field] = issue.message;
      }
    }
    return { fieldErrors };
  }

  const { email, password, username } = parsed.data;
  const supabase = await createClient();

  // Pre-check username uniqueness so we can return a clean field error
  // before creating an auth.users row. The handle_new_user trigger has a
  // UNIQUE constraint on profiles.username as a backstop, but failing there
  // happens AFTER the auth user is created — messier to recover from.
  const { data: taken } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (taken) {
    return { fieldErrors: { username: "That username is taken." } };
  }

  const origin = await getOrigin();

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Carries through to auth.users.raw_user_meta_data; the
      // handle_new_user trigger (migration 0009) pulls it into profiles.
      data: { username },
      // Where Supabase sends the user after they click the confirmation
      // link. /auth/callback exchanges the PKCE code for a session and
      // forwards to ?next= (the layout will then route new users to /wizard).
      emailRedirectTo: `${origin}/auth/callback?next=/dashboard`,
    },
  });

  if (signUpError) {
    if (signUpError.message.toLowerCase().includes("already")) {
      return { fieldErrors: { email: "An account with that email exists." } };
    }
    return { error: signUpError.message };
  }

  if (!signUpData.user) {
    return { error: "Signup succeeded but no user was returned." };
  }

  // If Confirm Email is OFF on the Supabase project, signUp returns a session
  // and the user is already logged in — send them straight to the dashboard
  // (the layout handles the wizard redirect for first-timers).
  if (signUpData.session) {
    redirect("/dashboard");
  }

  // Confirm Email is ON — user has no session yet. Park them on the
  // check-email screen where they wait for the confirmation link.
  redirect(`/signup/check-email?email=${encodeURIComponent(email)}`);
}
