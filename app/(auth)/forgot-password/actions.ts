"use server";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  email: z.string().email("Enter a valid email."),
});

export type ForgotPasswordState = {
  success?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<"email", string>>;
};

export async function forgotPasswordAction(
  _prev: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const parsed = schema.safeParse({ email: formData.get("email") });

  if (!parsed.success) {
    return {
      fieldErrors: {
        email: parsed.error.issues[0]?.message ?? "Invalid email.",
      },
    };
  }

  // Strip any trailing slash so we don't build `https://host//auth/callback`.
  const origin = (
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3000"
  ).replace(/\/+$/, "");

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(
    parsed.data.email,
    { redirectTo: `${origin}/auth/callback?next=/reset-password` },
  );

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}
