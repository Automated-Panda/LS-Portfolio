// app/admin/admin-nav-link.tsx
"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export function AdminNavLink({
  href,
  icon: Icon,
  children,
  badge,
}: {
  href: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  /** Unread/attention count shown as a small pill on the right. */
  badge?: number;
}) {
  const pathname = usePathname();
  const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
        active
          ? "bg-accent font-medium text-accent-foreground"
          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
      )}
    >
      {Icon && <Icon className={cn("h-4 w-4 shrink-0", active && "text-[#84cc16]")} />}
      <span className="truncate">{children}</span>
      {badge != null && badge > 0 && (
        <span className="ml-auto shrink-0 rounded-full bg-red-600 px-1.5 text-[10px] font-bold tabular-nums text-white">
          {badge}
        </span>
      )}
    </Link>
  );
}
