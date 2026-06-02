import { ArrowLeft, Download } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getRole } from "@/lib/admin/guard";
import { isAdminRole, isOwnerRole } from "@/lib/admin/roles";

import { AdminNav } from "./admin-nav";

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
        <Link href="/admin" aria-label="GT Vault Admin">
          <Image
            src="/admin/admin-logo.png"
            alt="GT Vault Admin"
            width={2560}
            height={1440}
            priority
            className="h-auto w-44"
          />
        </Link>
        <p className="mt-1 px-1 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          {role}
        </p>

        <AdminNav owner={owner} />

        <div className="mt-5 flex flex-col gap-0.5 border-t pt-4">
          <a
            href="/admin/export"
            className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
          >
            <Download className="h-4 w-4 shrink-0" />
            Export backup
          </a>
          <Link
            href="/"
            className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            Back to app
          </Link>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-6">{children}</main>
    </div>
  );
}
