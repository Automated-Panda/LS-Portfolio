// app/admin/admin-nav.tsx
"use client";

import {
  Building2,
  Car,
  Home,
  LayoutDashboard,
  LifeBuoy,
  LineChart,
  ScrollText,
  Users,
} from "lucide-react";

import { AdminNavLink } from "./admin-nav-link";

// Client component: it owns the Lucide icon components so they are never passed
// as props across the server→client boundary (which RSC cannot serialize).
export function AdminNav({
  owner,
  inboxUnread = 0,
}: {
  owner: boolean;
  inboxUnread?: number;
}) {
  return (
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
        <AdminNavLink href="/admin/properties" icon={Home}>
          Properties
        </AdminNavLink>
        <AdminNavLink href="/admin/businesses" icon={Building2}>
          Businesses
        </AdminNavLink>
      </Section>
      <Section label="Support">
        <AdminNavLink href="/admin/support" icon={LifeBuoy} badge={inboxUnread}>
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
