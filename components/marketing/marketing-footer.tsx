// components/marketing/marketing-footer.tsx
import Link from "next/link";

import { Logo } from "@/components/logo";

export function MarketingFooter() {
  return (
    <footer className="border-t border-neutral-800 bg-[#0a0a0a]">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="flex flex-col gap-3">
            <Logo size="sm" />
            <p className="max-w-xs text-sm text-neutral-500">
              Track your entire GTA V empire — vehicles, properties, businesses
              and more.
            </p>
          </div>
          <nav className="flex flex-col gap-2 text-sm text-neutral-400">
            <a href="#features" className="hover:text-neutral-100">Features</a>
            <a href="#pricing" className="hover:text-neutral-100">Pricing</a>
            <a href="#faq" className="hover:text-neutral-100">FAQ</a>
            <Link href="/login" className="hover:text-neutral-100">Sign in</Link>
            <Link href="/signup" className="hover:text-neutral-100">Get started</Link>
          </nav>
          <nav className="flex flex-col gap-2 text-sm text-neutral-400">
            <Link href="/privacy" className="hover:text-neutral-100">Privacy</Link>
            <Link href="/terms" className="hover:text-neutral-100">Terms</Link>
          </nav>
        </div>
        <p className="mt-10 border-t border-neutral-800 pt-6 text-xs leading-relaxed text-neutral-600">
          GT Vault is an unofficial fan-made tool. Not affiliated with,
          endorsed, sponsored, or approved by Rockstar Games or Take-Two
          Interactive. Grand Theft Auto and GTA are trademarks of their
          respective owners.
        </p>
      </div>
    </footer>
  );
}
