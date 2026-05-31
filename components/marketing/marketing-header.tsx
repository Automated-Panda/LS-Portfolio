// components/marketing/marketing-header.tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";

import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#faq", label: "FAQ" },
];

export function MarketingHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-800 bg-[#0a0a0a]/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" aria-label="GT Vault — home">
          <Logo size="sm" />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm text-neutral-400 transition-colors hover:text-neutral-100"
            >
              {l.label}
            </a>
          ))}
          <Link
            href="/login"
            className="text-sm text-neutral-100 transition-colors hover:text-[#84cc16]"
          >
            Sign in
          </Link>
          <Button
            asChild
            className="bg-[#84cc16] text-black hover:bg-[#84cc16]/90"
          >
            <Link href="/signup">Get started</Link>
          </Button>
        </nav>

        {/* Mobile toggle */}
        <button
          type="button"
          className="text-neutral-100 md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>

      {/* Mobile menu */}
      <div
        className={cn(
          "border-t border-neutral-800 md:hidden",
          open ? "block" : "hidden",
        )}
      >
        <nav className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-4">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="text-sm text-neutral-400 hover:text-neutral-100"
            >
              {l.label}
            </a>
          ))}
          <Link
            href="/login"
            onClick={() => setOpen(false)}
            className="text-sm text-neutral-100"
          >
            Sign in
          </Link>
          <Button
            asChild
            className="bg-[#84cc16] text-black hover:bg-[#84cc16]/90"
          >
            <Link href="/signup" onClick={() => setOpen(false)}>
              Get started
            </Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
