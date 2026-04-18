"use client";

import { LogOut, User as UserIcon } from "lucide-react";
import Link from "next/link";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logOutAction } from "@/lib/auth/actions";

type Props = {
  email: string;
  username: string | null;
  displayName: string | null;
};

export function UserMenu({ email, username, displayName }: Props) {
  const shownName = displayName || username || email;
  const initials = shownName.slice(0, 2).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="flex h-auto items-center gap-2 px-2 py-1.5">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="hidden flex-col items-start text-left sm:flex">
            <span className="text-sm font-medium leading-tight">
              {shownName}
            </span>
            {username && displayName && (
              <span className="text-xs text-muted-foreground leading-tight">
                @{username}
              </span>
            )}
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <span className="text-sm font-medium">{email}</span>
            {username && (
              <span className="text-xs text-muted-foreground">@{username}</span>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile" className="cursor-pointer">
            <UserIcon className="mr-2 h-4 w-4" />
            Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action={logOutAction}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full cursor-pointer">
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
