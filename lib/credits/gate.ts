// lib/credits/gate.ts
// Server-only wrappers that apply the owner-unlimited policy on top of the
// Plan 1 ledger. The Organizer actions charge through these so owner-bypass and
// the display shape live in ONE place.
import "server-only";

import { getBalance, spendCredits } from "./server";
import { isUnlimitedEmail, type CreditDisplay } from "./access";

/** Current balance for display. Owner → unlimited (total is ignored by the UI). */
export async function organizerBalance(
  userId: string,
  email: string | null | undefined,
): Promise<CreditDisplay> {
  if (isUnlimitedEmail(email)) return { total: 0, unlimited: true };
  return { total: await getBalance(userId), unlimited: false };
}

export type ChargeResult =
  | { ok: true; balance: CreditDisplay }
  | { ok: false; needed: number; balance: CreditDisplay };

/**
 * Charge `amount` credits for an Organizer action. Owner → free (unlimited).
 * On insufficient balance, charges nothing and returns ok:false with what was
 * needed and the current balance (for the out-of-credits wall).
 */
export async function chargeOrganizer(
  userId: string,
  email: string | null | undefined,
  amount: number,
  kind: "plan" | "tweak" | "clarify" | "failure",
): Promise<ChargeResult> {
  if (isUnlimitedEmail(email)) return { ok: true, balance: { total: 0, unlimited: true } };

  const result = await spendCredits(userId, amount, "spend", { feature: "organizer", kind });
  if (result.ok) {
    return { ok: true, balance: { total: result.remaining, unlimited: false } };
  }
  return { ok: false, needed: amount, balance: { total: await getBalance(userId), unlimited: false } };
}
