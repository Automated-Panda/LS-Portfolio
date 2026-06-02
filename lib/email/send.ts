// lib/email/send.ts
import "server-only";

import { sendEmail, type SendResult } from "./client";
import { creditsAdjustedEmail } from "./templates/credits-adjusted";

export async function sendCreditsAdjustedEmail(
  to: string,
  opts: { delta: number; newBalance: number; note?: string | null },
): Promise<SendResult> {
  const { subject, html } = creditsAdjustedEmail(opts);
  return sendEmail({ to, subject, html });
}
