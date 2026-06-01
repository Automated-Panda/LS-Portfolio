// lib/credits/access.ts
// Pure credit-access policy. Decides who has unlimited AI credits.
// Today that's just the owner (ADMIN_EMAIL). Future Editor/Developer roles
// will extend this module (they get generous *finite* monthly credits, not
// unlimited — see project memory). No I/O so it stays unit-testable.

/** Balance shape passed to the UI. `unlimited` users ignore `total`. */
export type CreditDisplay = { total: number; unlimited: boolean };

/** True if this email is the owner (unlimited credits, never charged/gated). */
export function isUnlimitedEmail(email: string | null | undefined): boolean {
  const owner = process.env.ADMIN_EMAIL;
  if (!owner || !email) return false;
  return email.toLowerCase() === owner.toLowerCase();
}
