"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

import {
  NAV_PINNED,
  NAV_SECTIONS,
  type NavCounts,
  type NavItem,
} from "./nav-items";

export function SidebarNav({
  counts,
  onNavigate,
}: {
  counts: NavCounts;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  const renderItem = (item: NavItem) => {
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
            : item.highlight
              ? "bg-[#84cc16]/10 font-medium text-[#65a30d] ring-1 ring-inset ring-[#84cc16]/30 hover:bg-[#84cc16]/20 dark:text-[#a3e635]"
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
  };

  return (
    <nav className="flex flex-col gap-4 p-3">
      <div className="flex flex-col gap-1">{NAV_PINNED.map(renderItem)}</div>

      {NAV_SECTIONS.map((section) => (
        <div key={section.label} className="flex flex-col gap-1">
          <p className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            {section.label}
          </p>
          {section.items.map(renderItem)}
        </div>
      ))}
    </nav>
  );
}
