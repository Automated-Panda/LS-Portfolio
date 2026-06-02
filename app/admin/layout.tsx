import {
  ArrowLeft,
  Building2,
  Car,
  Download,
  LayoutDashboard,
  LifeBuoy,
  LineChart,
  ScrollText,
  Users,
  Wrench,
} from "lucide-react";
import Image from "next/image";
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

        <nav className="mt-5 flex flex-1 flex-col gap-5 overflow-y-auto">
          <Section label="Overview">
            <AdminNavLink href="/admin" icon={LayoutDashboard}>
              Dashboard
            </AdminNavLink>
          </Section>
          <Section label="Content">
            <AdminNavLink href="/admin/vehicles" icon={Car}>
              Vehicles
            </AdminNavLink>
            <AdminNavLink href="/admin/properties" icon={Building2}>
              Properties &amp; Businesses
            </AdminNavLink>
            <AdminNavLink href="/admin/upgrades" icon={Wrench}>
              Upgrades
            </AdminNavLink>
          </Section>
          <Section label="Support">
            <AdminNavLink href="/admin/support" icon={LifeBuoy}>
              Inbox
            </AdminNavLink>
          </Section>
          {owner && (
            <Section label="People">
              <AdminNavLink href="/admin/users" icon={Users}>
                Users
              </AdminNavLink>
            </Section>
          )}
          {owner && (
            <Section label="Business">
              <AdminNavLink href="/admin/revenue" icon={LineChart}>
                Revenue
              </AdminNavLink>
            </Section>
          )}
          {owner && (
            <Section label="Audit">
              <AdminNavLink href="/admin/activity" icon={ScrollText}>
                Activity
              </AdminNavLink>
            </Section>
          )}
        </nav>

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

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
        {label}
      </p>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}
