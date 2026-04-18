"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  forgotPasswordAction,
  type ForgotPasswordState,
} from "./actions";

export function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState<
    ForgotPasswordState,
    FormData
  >(forgotPasswordAction, {});

  if (state.success) {
    return (
      <div className="space-y-4">
        <Alert>
          <AlertDescription>
            If that email exists, a reset link is on its way. In local dev you
            can view it in Mailpit at{" "}
            <a
              href="http://127.0.0.1:54324"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              127.0.0.1:54324
            </a>
            .
          </AlertDescription>
        </Alert>
        <Link
          href="/login"
          className="block text-center text-sm text-muted-foreground hover:text-foreground"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
        {state.fieldErrors?.email && (
          <p className="text-sm text-destructive">{state.fieldErrors.email}</p>
        )}
      </div>

      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Sending…" : "Send reset link"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link href="/login" className="text-foreground hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
