// lib/email/client.ts
// Resend wrapper. Best-effort: when RESEND_API_KEY is unset, send() is a no-op
// (returns { skipped: true }) so features are never blocked on email setup.
import "server-only";

import { Resend } from "resend";

let cached: Resend | null = null;

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!cached) cached = new Resend(key);
  return cached;
}

export type SendResult = { sent: boolean; skipped?: boolean; error?: string };

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<SendResult> {
  const resend = getResend();
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY unset — skipping email to ${opts.to}`);
    return { sent: false, skipped: true };
  }
  const from = process.env.EMAIL_FROM ?? "GT Vault <noreply@gtvault.app>";
  try {
    await resend.emails.send({
      from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
    return { sent: true };
  } catch (e) {
    console.error("[email] send failed:", e);
    return { sent: false, error: e instanceof Error ? e.message : String(e) };
  }
}
