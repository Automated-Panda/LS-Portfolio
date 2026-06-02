"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDialogHost } from "@/components/ui/confirm-dialog";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";

import type { NavCounts } from "./nav-items";
import { NotificationBell } from "./notification-bell";
import { SidebarNav } from "./sidebar-nav";
import { UserMenu } from "./user-menu";

type Props = {
  email: string;
  username: string | null;
  displayName: string | null;
  notifications: import("@/lib/notifications/types").NotificationRow[];
  unreadCount: number;
  counts: NavCounts;
  children: React.ReactNode;
};

export function AppShell({
  email,
  username,
  displayName,
  notifications,
  unreadCount,
  counts,
  children,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r bg-card md:flex">
        <div className="flex h-14 shrink-0 items-center border-b px-4">
          <Link href="/dashboard" aria-label="GT Vault — Dashboard">
            <Logo size="sm" />
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto">
          <SidebarNav counts={counts} />
        </div>
      </aside>

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 border-r bg-card transition-transform md:hidden",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-14 items-center justify-between border-b px-4">
          <Link
            href="/dashboard"
            onClick={() => setOpen(false)}
            aria-label="GT Vault — Dashboard"
          >
            <Logo size="sm" />
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        <SidebarNav counts={counts} onNavigate={() => setOpen(false)} />
      </aside>

      {open && (
        <button
          aria-label="Close menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
        />
      )}

      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex-1" />
          <NotificationBell notifications={notifications} unread={unreadCount} />
          <UserMenu
            email={email}
            username={username}
            displayName={displayName}
          />
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
      <ConfirmDialogHost />
    </div>
  );
}
