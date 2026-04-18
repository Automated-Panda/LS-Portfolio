"use server";

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

  const { data: taken } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (taken) {
    return { fieldErrors: { username: "That username is taken." } };
  }

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
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

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ username })
    .eq("id", signUpData.user.id);

  if (updateError) {
    if (updateError.code === "23505") {
      return { fieldErrors: { username: "That username is taken." } };
    }
    return { error: "Account created but username couldn't be set." };
  }

  redirect("/dashboard");
}
