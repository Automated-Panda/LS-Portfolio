// lib/admin/roles.ts
// Pure role policy. ADMIN_EMAIL is always treated as owner (lockout safety net);
// everyone else's access comes from profiles.role. No I/O so it stays testable.

export type Role = "user" | "editor" | "owner";

export function resolveRole(
  dbRole: string | null | undefined,
  email: string | null | undefined,
  ownerEmail: string | null | undefined,
): Role {
  if (!email) return "user";
  if (ownerEmail && email.toLowerCase() === ownerEmail.toLowerCase()) {
    return "owner";
  }
  if (dbRole === "owner" || dbRole === "editor") return dbRole;
  return "user";
}

export function isAdminRole(role: Role): boolean {
  return role === "owner" || role === "editor";
}

export function isOwnerRole(role: Role): boolean {
  return role === "owner";
}
