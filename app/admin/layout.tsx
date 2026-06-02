import Link from "next/link";
import { redirect } from "next/navigation";

import { getRole } from "@/lib/admin/guard";
import { isAdminRole, isOwnerRole } from "@/lib/admin/roles";

import { AdminNavLink } from "./admin-nav-link";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const role = await getRole();
  if (!isAdminRole(role)) redirect("/");
  const owner = isOwnerRole(role);

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r bg-card p-4 md:flex">
        <Link href="/admin" className="text-lg font-semibold">
          ⚙️ GT Vault Admin
        </Link>
        <nav className="mt-6 flex flex-1 flex-col gap-6">
          <div>
            <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              Overview
            </p>
            <AdminNavLink href="/admin">Dashboard</AdminNavLink>
          </div>
          <div>
            <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              Content
            </p>
            <AdminNavLink href="/admin/vehicles">Vehicles</AdminNavLink>
            <AdminNavLink href="/admin/properties">Properties &amp; Businesses</AdminNavLink>
            <AdminNavLink href="/admin/upgrades">Upgrades</AdminNavLink>
          </div>
          {owner && (
            <div>
              <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                People
              </p>
              <AdminNavLink href="/admin/users">Users</AdminNavLink>
            </div>
          )}
        </nav>
        <div className="mt-6 flex flex-col gap-2 border-t pt-4 text-sm">
          <a href="/admin/export" className="text-muted-foreground hover:underline">
            ⬇ Export backup
          </a>
          <Link href="/" className="text-muted-foreground hover:underline">
            ← Back to app
          </Link>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-6">{children}</main>
    </div>
  );
}
