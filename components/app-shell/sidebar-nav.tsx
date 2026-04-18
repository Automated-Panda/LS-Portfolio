"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

import { NAV_ITEMS, type NavCounts } from "./nav-items";

export function SidebarNav({
  counts,
  onNavigate,
}: {
  counts: NavCounts;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 p-3">
      {NAV_ITEMS.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        const count = item.badgeKey ? counts[item.badgeKey] : undefined;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              active
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="flex-1">{item.label}</span>
            {count !== undefined && count > 0 && (
              <span
                className={cn(
                  "flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[11px] font-medium tabular-nums",
                  active
                    ? "bg-background/60 text-foreground"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
