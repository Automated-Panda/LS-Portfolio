"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export type ResetPasswordState = {
  error?: string;
  fieldErrors?: Partial<Record<"password", string>>;
};

export async function resetPasswordAction(
  _prev: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const parsed = schema.safeParse({ password: formData.get("password") });

  if (!parsed.success) {
    return {
      fieldErrors: {
        password:
          parsed.error.issues[0]?.message ?? "Invalid password.",
      },
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return { error: error.message };
  }

  redirect("/dashboard");
}
