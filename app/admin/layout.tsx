import Link from "next/link";
import { redirect } from "next/navigation";

import { isAdmin } from "@/lib/admin/guard";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await isAdmin())) redirect("/");

  return (
    <div className="mx-auto max-w-7xl p-4">
      <header className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-b pb-3">
        <Link href="/admin" className="text-xl font-semibold">
          ⚙️ Admin
        </Link>
        <nav className="flex gap-3 text-sm">
          <Link href="/admin/vehicles" className="hover:underline">
            Vehicles
          </Link>
          <Link href="/admin/properties" className="hover:underline">
            Properties &amp; Businesses
          </Link>
          <Link href="/admin/upgrades" className="hover:underline">
            Upgrades
          </Link>
        </nav>
        <a
          href="/admin/export"
          className="ml-auto text-sm text-muted-foreground hover:underline"
        >
          ⬇ Export backup
        </a>
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Back to app
        </Link>
      </header>
      {children}
    </div>
  );
}
