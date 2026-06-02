// app/admin/admin-nav-link.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export function AdminNavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
  return (
    <Link
      href={href}
      className={cn(
        "block rounded-md px-2 py-1.5 text-sm transition-colors",
        active
          ? "bg-accent font-medium text-accent-foreground"
          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}
