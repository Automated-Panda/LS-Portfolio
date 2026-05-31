# GT Vault Marketing Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the GT Vault marketing landing page at `gtvault.app/` — a single scrolling page that converts visitors to signups, showcasing the real app.

**Architecture:** Path-based on one domain. All work lives in the existing `app/(marketing)/` route group. `layout.tsx` provides shared header + footer; `page.tsx` composes section components from `components/marketing/`. Sections are presentational React Server Components (Next.js 15 App Router); only the mobile nav and FAQ accordion are client components. Reuses the app's shadcn/ui `Button` and Tailwind theme.

**Tech Stack:** Next.js 15 (App Router, RSC), React 19, Tailwind CSS, shadcn/ui, lucide-react, next/image.

---

## Conventions for this plan

- **No test runner exists** in this repo. "Verify" steps use `npm run typecheck` and `npm run lint`, plus a visual check via `npm run dev` (open `http://localhost:3000`). There is no Jest/Vitest — do **not** add one.
- **Brand accent green is lime `#84cc16`** (matches the logo lockup). The app's `accent`/`secondary` theme tokens are a *different* forest green (`142 65% 38%`) — do NOT use `text-accent`/`bg-accent` for marketing green. Use the literal Tailwind arbitrary values `text-[#84cc16]`, `bg-[#84cc16]`, `border-[#84cc16]`. Primary CTA buttons use `bg-[#84cc16] text-black hover:bg-[#84cc16]/90`.
- **Display font:** `font-display` (already defined in `tailwind.config.ts` → Anton/Impact). Used only for eyebrow labels.
- **Page is forced dark.** The root `<html>` already has `dark` applied (`app/layout.tsx`), and the marketing background is `#0a0a0a`. Use explicit dark colors (`text-neutral-100`, `text-neutral-400`, `bg-neutral-950`, `border-neutral-800`) rather than theme tokens, so the marketing palette is self-contained and matches the approved design system (bg `#0a0a0a`, surface `#101010`, border `#222`, text `#f5f5f5`, muted `#a3a3a3`).
- **Icons:** lucide-react only. Never emoji.
- **Commit after each task.** Branch: do all work on a new branch `feat/marketing-landing` (create in Task 0).
- **Screenshots:** Tasks 3/6/7 reference real screenshot files at `/public/marketing/*.webp`. Until Task 12 captures them, use the existing `/logo-mark.png` as a temporary `src` so layout/dimensions are correct and nothing 404s. Task 12 swaps in the real captures.

---

## File Structure

- `app/(marketing)/layout.tsx` — MODIFY: shared marketing header + footer wrapping all marketing pages.
- `app/(marketing)/page.tsx` — MODIFY: compose sections + logged-in→/dashboard redirect.
- `app/(marketing)/privacy/page.tsx` — CREATE: placeholder legal page.
- `app/(marketing)/terms/page.tsx` — CREATE: placeholder legal page.
- `components/marketing/marketing-header.tsx` — CREATE: top nav (client, for mobile menu).
- `components/marketing/marketing-footer.tsx` — CREATE: footer (server).
- `components/marketing/hero.tsx` — CREATE.
- `components/marketing/stat-bar.tsx` — CREATE.
- `components/marketing/feature-cards.tsx` — CREATE.
- `components/marketing/organizer-spotlight.tsx` — CREATE.
- `components/marketing/screenshot-showcase.tsx` — CREATE.
- `components/marketing/pricing-teaser.tsx` — CREATE.
- `components/marketing/faq.tsx` — CREATE (client, accordion).
- `components/marketing/final-cta.tsx` — CREATE.
- `components/marketing/section.tsx` — CREATE: shared section wrapper (max-width, padding, eyebrow label).
- `lib/marketing/stats.ts` — CREATE: server fn reading live catalog counts for the stat bar.
- `public/marketing/` — screenshots (added in Task 12).

---

## Task 0: Branch setup

- [ ] **Step 1: Create the working branch**

Run:
```bash
git checkout -b feat/marketing-landing
```
Expected: `Switched to a new branch 'feat/marketing-landing'`

- [ ] **Step 2: Confirm baseline is green**

Run:
```bash
npm run typecheck
```
Expected: no output / exits 0.

---

## Task 1: Shared section wrapper

A small presentational helper every section uses for consistent max-width, vertical padding, and the optional eyebrow label. Keeps spacing DRY.

**Files:**
- Create: `components/marketing/section.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/marketing/section.tsx
import { cn } from "@/lib/utils";

type SectionProps = {
  id?: string;
  eyebrow?: string;
  className?: string;
  children: React.ReactNode;
};

/**
 * Marketing section wrapper: centered max-width column, consistent vertical
 * rhythm, optional uppercase brand-green eyebrow label.
 */
export function Section({ id, eyebrow, className, children }: SectionProps) {
  return (
    <section
      id={id}
      className={cn("mx-auto w-full max-w-6xl px-6 py-20 md:py-28", className)}
    >
      {eyebrow && (
        <p className="mb-3 text-center font-display text-xs uppercase tracking-[0.28em] text-[#84cc16]">
          {eyebrow}
        </p>
      )}
      {children}
    </section>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: exits 0 (component is unused so far — that's fine).

- [ ] **Step 3: Commit**

```bash
git add components/marketing/section.tsx
git commit -m "feat(marketing): add shared Section wrapper"
```

---

## Task 2: Marketing header (top nav)

Client component (needs a mobile menu toggle). Lockup left; Features / FAQ / Sign in / Get started right. On mobile, links collapse behind a menu button.

**Files:**
- Create: `components/marketing/marketing-header.tsx`

- [ ] **Step 1: Create the component**

```tsx
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
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add components/marketing/marketing-header.tsx
git commit -m "feat(marketing): add marketing header with mobile menu"
```

---

## Task 3: Marketing footer

Server component. Lockup, nav links, legal links, and the Rockstar disclaimer (legally important per spec §4).

**Files:**
- Create: `components/marketing/marketing-footer.tsx`

- [ ] **Step 1: Create the component**

```tsx
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
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add components/marketing/marketing-footer.tsx
git commit -m "feat(marketing): add marketing footer with Rockstar disclaimer"
```

---

## Task 4: Wire header + footer into the marketing layout

**Files:**
- Modify: `app/(marketing)/layout.tsx`

- [ ] **Step 1: Replace the layout**

```tsx
// app/(marketing)/layout.tsx
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { MarketingFooter } from "@/components/marketing/marketing-footer";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-[#0a0a0a] text-neutral-100">
      <MarketingHeader />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add "app/(marketing)/layout.tsx"
git commit -m "feat(marketing): wrap marketing pages in header + footer"
```

---

## Task 5: Hero section

Locked design (spec §2): eyebrow → stars → headline → subcopy → dual CTA → framed screenshot.

**Files:**
- Create: `components/marketing/hero.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/marketing/hero.tsx
import Link from "next/link";
import Image from "next/image";

import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 pb-12 pt-20 text-center md:pt-28">
      <p className="font-display text-xs uppercase tracking-[0.28em] text-[#84cc16]">
        GTA V Asset Tracker
      </p>
      <p
        className="mt-3 text-sm tracking-[0.45em] text-[#84cc16]"
        aria-hidden="true"
      >
        ★★★★★
      </p>
      <h1 className="mx-auto mt-5 max-w-2xl text-4xl font-extrabold leading-[1.08] tracking-tight text-neutral-100 md:text-6xl">
        Track your entire GTA&nbsp;V empire
      </h1>
      <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-neutral-400 md:text-lg">
        Vehicles, properties, businesses, aircraft &amp; boats — your whole
        portfolio and its net worth, in one place.
      </p>
      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Button
          asChild
          size="lg"
          className="bg-[#84cc16] text-black hover:bg-[#84cc16]/90"
        >
          <Link href="/signup">Get started free</Link>
        </Button>
        <Button
          asChild
          size="lg"
          variant="outline"
          className="border-neutral-700 bg-transparent text-neutral-100 hover:bg-neutral-900 hover:text-neutral-100"
        >
          <a href="#features">See features</a>
        </Button>
      </div>

      <div className="mx-auto mt-16 max-w-4xl">
        <div className="overflow-hidden rounded-xl border border-neutral-800 bg-[#101010] shadow-[0_0_80px_rgba(132,204,22,0.08)]">
          <Image
            src="/marketing/dashboard.webp"
            alt="GT Vault dashboard showing net worth, vehicle and property counts, and catalog coverage"
            width={1600}
            height={900}
            priority
            className="h-auto w-full"
          />
        </div>
      </div>
    </section>
  );
}
```

> NOTE: `/marketing/dashboard.webp` does not exist yet. Before this renders, create a temporary placeholder so dev doesn't 404:
> ```bash
> mkdir -p public/marketing
> cp public/logo-mark.png public/marketing/dashboard.webp
> ```
> (Task 12 replaces it with the real capture. `next/image` will still serve a PNG named `.webp`; that's fine for the placeholder.)

- [ ] **Step 2: Create the placeholder image dir + file**

Run:
```bash
mkdir -p public/marketing && cp public/logo-mark.png public/marketing/dashboard.webp
```
Expected: no output.

- [ ] **Step 3: Verify typecheck**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add components/marketing/hero.tsx public/marketing/dashboard.webp
git commit -m "feat(marketing): add hero section"
```

---

## Task 6: Live catalog stats helper

Server function reading real catalog counts so the stat bar is accurate (spec §6). Mirrors the existing query pattern (`createClient` from `@/lib/supabase/server`, head+count selects like `lib/queries/dashboard.ts`).

**Files:**
- Create: `lib/marketing/stats.ts`

- [ ] **Step 1: Create the helper**

```ts
// lib/marketing/stats.ts
import { createClient } from "@/lib/supabase/server";

export type MarketingStats = {
  vehicles: number;
  properties: number; // non-business ownable
  businesses: number; // business-type ownable
};

/**
 * Live catalogue counts for the marketing stat bar. Counts catalogue rows
 * (what GT Vault can track), not user-owned rows. Businesses are split out by
 * property_type to match the rest of the app.
 */
export async function getMarketingStats(): Promise<MarketingStats> {
  const supabase = await createClient();

  const [vehiclesRes, propsRes] = await Promise.all([
    supabase.from("vehicles").select("id", { count: "exact", head: true }),
    supabase.from("properties").select("property_type"),
  ]);

  const vehicles = vehiclesRes.count ?? 0;

  let properties = 0;
  let businesses = 0;
  for (const row of propsRes.data ?? []) {
    if (row.property_type === "business") businesses += 1;
    else properties += 1;
  }

  return { vehicles, properties, businesses };
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add lib/marketing/stats.ts
git commit -m "feat(marketing): add live catalog stats helper"
```

---

## Task 7: Stat bar section

A thin band of big numbers. Receives stats as props (page fetches them) so the component stays presentational.

**Files:**
- Create: `components/marketing/stat-bar.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/marketing/stat-bar.tsx
import type { MarketingStats } from "@/lib/marketing/stats";

function roundDown(n: number): string {
  if (n < 50) return String(n);
  const floored = Math.floor(n / 10) * 10;
  return `${floored}+`;
}

export function StatBar({ stats }: { stats: MarketingStats }) {
  const items = [
    { value: roundDown(stats.vehicles), label: "Vehicles tracked" },
    { value: roundDown(stats.properties), label: "Properties & garages" },
    { value: roundDown(stats.businesses), label: "Businesses" },
  ];
  return (
    <div className="border-y border-neutral-800 bg-[#101010]">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-6 py-10 sm:grid-cols-3">
        {items.map((it) => (
          <div key={it.label} className="text-center">
            <div className="text-3xl font-extrabold tabular-nums text-neutral-100 md:text-4xl">
              {it.value}
            </div>
            <div className="mt-1 text-sm text-neutral-400">{it.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add components/marketing/stat-bar.tsx
git commit -m "feat(marketing): add stat bar section"
```

---

## Task 8: Feature cards section

3–4 cards (spec §3.3): Track everything · Net worth · Catalog coverage · Storage management. Lucide icons, no emoji.

**Files:**
- Create: `components/marketing/feature-cards.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/marketing/feature-cards.tsx
import { Boxes, Wallet, Trophy, Warehouse } from "lucide-react";

import { Section } from "./section";

const FEATURES = [
  {
    icon: Boxes,
    title: "Track everything",
    body: "Vehicles, properties, businesses, aircraft and boats — your full GTA V portfolio in one place.",
  },
  {
    icon: Wallet,
    title: "Know your net worth",
    body: "See the total value of everything you own, broken down by category.",
  },
  {
    icon: Trophy,
    title: "Catalog coverage",
    body: "Track how close you are to owning it all — per category, against the in-game caps.",
  },
  {
    icon: Warehouse,
    title: "Storage management",
    body: "Assign vehicles to specific garages and properties, and keep capacity under control.",
  },
];

export function FeatureCards() {
  return (
    <Section id="features" eyebrow="What you get">
      <h2 className="text-center text-3xl font-bold tracking-tight text-neutral-100 md:text-4xl">
        Everything you own, organized
      </h2>
      <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f) => {
          const Icon = f.icon;
          return (
            <div
              key={f.title}
              className="rounded-xl border border-neutral-800 bg-[#101010] p-6"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#84cc16]/10 text-[#84cc16]">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold text-neutral-100">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-400">
                {f.body}
              </p>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add components/marketing/feature-cards.tsx
git commit -m "feat(marketing): add feature cards section"
```

---

## Task 9: AI Organizer spotlight ("Pro · Coming soon")

Spec §5: marquee Pro feature, clearly not-yet-available, with example prompt + screenshot.

**Files:**
- Create: `components/marketing/organizer-spotlight.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/marketing/organizer-spotlight.tsx
import Image from "next/image";
import { Sparkles } from "lucide-react";

import { Section } from "./section";

export function OrganizerSpotlight() {
  return (
    <Section eyebrow="Pro · Coming soon">
      <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#84cc16]/40 bg-[#84cc16]/10 px-3 py-1 text-xs font-medium text-[#84cc16]">
            <Sparkles className="h-3.5 w-3.5" />
            Pro · Coming soon
          </span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-neutral-100 md:text-4xl">
            Organize your garage with AI
          </h2>
          <p className="mt-4 text-base leading-relaxed text-neutral-400">
            Describe what you want in plain English and the AI Organizer plans
            the moves and applies them for you.
          </p>
          <div className="mt-6 rounded-lg border border-neutral-800 bg-[#101010] p-4">
            <p className="text-xs uppercase tracking-wider text-neutral-500">
              You type
            </p>
            <p className="mt-1 text-neutral-200">
              &ldquo;Put all my sports cars in Eclipse Towers&rdquo;
            </p>
            <p className="mt-3 text-sm text-[#84cc16]">
              → GT Vault plans the moves and does it.
            </p>
          </div>
        </div>
        <div className="overflow-hidden rounded-xl border border-neutral-800 bg-[#101010]">
          <Image
            src="/marketing/organizer.webp"
            alt="GT Vault AI Organizer turning a natural-language request into a plan of vehicle moves"
            width={1200}
            height={900}
            loading="lazy"
            className="h-auto w-full"
          />
        </div>
      </div>
    </Section>
  );
}
```

- [ ] **Step 2: Create the placeholder image**

Run:
```bash
cp public/logo-mark.png public/marketing/organizer.webp
```
Expected: no output.

- [ ] **Step 3: Verify typecheck**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add components/marketing/organizer-spotlight.tsx public/marketing/organizer.webp
git commit -m "feat(marketing): add AI Organizer Pro spotlight"
```

---

## Task 10: Screenshot showcase

Spec §3.5: 2–3 real shots in alternating image/text rows.

**Files:**
- Create: `components/marketing/screenshot-showcase.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/marketing/screenshot-showcase.tsx
import Image from "next/image";

import { Section } from "./section";
import { cn } from "@/lib/utils";

const SHOTS = [
  {
    src: "/marketing/vehicles.webp",
    alt: "GT Vault vehicles browser showing the GTA V vehicle catalog with owned counts and filters",
    title: "Browse the full catalog",
    body: "Every vehicle in the game, searchable and filterable, with your owned count on each.",
  },
  {
    src: "/marketing/property.webp",
    alt: "GT Vault property detail showing storage upgrades and assigned vehicles",
    title: "Manage your properties",
    body: "Track upgrades, storage capacity and exactly which vehicles live where.",
  },
];

export function ScreenshotShowcase() {
  return (
    <Section eyebrow="See it in action">
      <div className="flex flex-col gap-20">
        {SHOTS.map((shot, i) => (
          <div
            key={shot.src}
            className="grid grid-cols-1 items-center gap-8 lg:grid-cols-2"
          >
            <div className={cn(i % 2 === 1 && "lg:order-2")}>
              <h3 className="text-2xl font-bold tracking-tight text-neutral-100">
                {shot.title}
              </h3>
              <p className="mt-3 text-base leading-relaxed text-neutral-400">
                {shot.body}
              </p>
            </div>
            <div
              className={cn(
                "overflow-hidden rounded-xl border border-neutral-800 bg-[#101010]",
                i % 2 === 1 && "lg:order-1",
              )}
            >
              <Image
                src={shot.src}
                alt={shot.alt}
                width={1200}
                height={800}
                loading="lazy"
                className="h-auto w-full"
              />
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
```

- [ ] **Step 2: Create placeholder images**

Run:
```bash
cp public/logo-mark.png public/marketing/vehicles.webp && cp public/logo-mark.png public/marketing/property.webp
```
Expected: no output.

- [ ] **Step 3: Verify typecheck**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add components/marketing/screenshot-showcase.tsx public/marketing/vehicles.webp public/marketing/property.webp
git commit -m "feat(marketing): add screenshot showcase section"
```

---

## Task 11: Pricing teaser

Spec §3.6: soft "Free to use. Pro coming soon." No purchase flow.

**Files:**
- Create: `components/marketing/pricing-teaser.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/marketing/pricing-teaser.tsx
import { Check } from "lucide-react";

import { Section } from "./section";

const FREE = [
  "Track unlimited vehicles, properties & businesses",
  "Net worth & catalog coverage",
  "Storage management",
];

export function PricingTeaser() {
  return (
    <Section eyebrow="Pricing">
      <h2 className="text-center text-3xl font-bold tracking-tight text-neutral-100 md:text-4xl">
        Free to use
      </h2>
      <p className="mx-auto mt-3 max-w-md text-center text-neutral-400">
        Everything you need to track your empire, free. A Pro tier with the AI
        Organizer is coming.
      </p>
      <div className="mx-auto mt-10 max-w-md rounded-xl border border-neutral-800 bg-[#101010] p-8">
        <ul className="flex flex-col gap-3">
          {FREE.map((f) => (
            <li key={f} className="flex items-start gap-3 text-sm text-neutral-300">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#84cc16]" />
              {f}
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add components/marketing/pricing-teaser.tsx
git commit -m "feat(marketing): add pricing teaser section"
```

---

## Task 12: FAQ section

Spec §4: five questions. Client component with a simple expand/collapse (native `<details>` keeps it accessible with zero JS state).

**Files:**
- Create: `components/marketing/faq.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/marketing/faq.tsx
import { Section } from "./section";

const FAQS = [
  {
    q: "Is it free?",
    a: "Yes — GT Vault is free to use. A Pro tier, including the AI Organizer, is coming.",
  },
  {
    q: "Is this affiliated with Rockstar or Take-Two?",
    a: "No. GT Vault is a fan-made, unofficial tool. It is not affiliated with, endorsed by, or sponsored by Rockstar Games.",
  },
  {
    q: "Does it connect to my GTA account or sync automatically?",
    a: "No — there is no Rockstar API. You mark what you own manually, and GT Vault keeps track of it for you.",
  },
  {
    q: "What platforms does it cover?",
    a: "GTA V / GTA Online. The catalog data is universal, so it works whether you play on PC or console.",
  },
  {
    q: "Is my data safe?",
    a: "Your portfolio is tied to your account and private to you. You can wipe it any time from your profile.",
  },
];

export function Faq() {
  return (
    <Section id="faq" eyebrow="FAQ">
      <h2 className="text-center text-3xl font-bold tracking-tight text-neutral-100 md:text-4xl">
        Questions &amp; answers
      </h2>
      <div className="mx-auto mt-10 max-w-2xl divide-y divide-neutral-800 border-y border-neutral-800">
        {FAQS.map((item) => (
          <details key={item.q} className="group py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between text-neutral-100">
              <span className="font-medium">{item.q}</span>
              <span className="ml-4 text-[#84cc16] transition-transform group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-neutral-400">
              {item.a}
            </p>
          </details>
        ))}
      </div>
    </Section>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add components/marketing/faq.tsx
git commit -m "feat(marketing): add FAQ section"
```

---

## Task 13: Final CTA section

Spec §3.8.

**Files:**
- Create: `components/marketing/final-cta.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/marketing/final-cta.tsx
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Section } from "./section";

export function FinalCta() {
  return (
    <Section>
      <div className="rounded-2xl border border-neutral-800 bg-[#101010] px-6 py-16 text-center">
        <h2 className="mx-auto max-w-xl text-3xl font-extrabold tracking-tight text-neutral-100 md:text-4xl">
          Start tracking your empire
        </h2>
        <p className="mx-auto mt-3 max-w-md text-neutral-400">
          Free to use. Set up your portfolio in minutes.
        </p>
        <div className="mt-8">
          <Button
            asChild
            size="lg"
            className="bg-[#84cc16] text-black hover:bg-[#84cc16]/90"
          >
            <Link href="/signup">Get started free</Link>
          </Button>
        </div>
      </div>
    </Section>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add components/marketing/final-cta.tsx
git commit -m "feat(marketing): add final CTA section"
```

---

## Task 14: Compose the landing page + logged-in redirect

Spec §8: `page.tsx` composes sections in order, fetches stats, and redirects authenticated users to `/dashboard`.

**Files:**
- Modify: `app/(marketing)/page.tsx`

- [ ] **Step 1: Replace the page**

```tsx
// app/(marketing)/page.tsx
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getMarketingStats } from "@/lib/marketing/stats";

import { Hero } from "@/components/marketing/hero";
import { StatBar } from "@/components/marketing/stat-bar";
import { FeatureCards } from "@/components/marketing/feature-cards";
import { OrganizerSpotlight } from "@/components/marketing/organizer-spotlight";
import { ScreenshotShowcase } from "@/components/marketing/screenshot-showcase";
import { PricingTeaser } from "@/components/marketing/pricing-teaser";
import { Faq } from "@/components/marketing/faq";
import { FinalCta } from "@/components/marketing/final-cta";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  const stats = await getMarketingStats();

  return (
    <>
      <Hero />
      <StatBar stats={stats} />
      <FeatureCards />
      <OrganizerSpotlight />
      <ScreenshotShowcase />
      <PricingTeaser />
      <Faq />
      <FinalCta />
    </>
  );
}
```

- [ ] **Step 2: Verify typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: exits 0.

- [ ] **Step 3: Visual check (anonymous)**

Run: `npm run dev`, open `http://localhost:3000/` in a logged-out browser (or private window).
Expected: full landing page renders top to bottom (placeholders show the logo mark where screenshots will go); mobile menu works at 375px width; "Get started" links go to `/signup`.

- [ ] **Step 4: Visual check (logged-in redirect)**

In a browser with an active GT Vault session, visit `http://localhost:3000/`.
Expected: immediate redirect to `/dashboard`.

- [ ] **Step 5: Commit**

```bash
git add "app/(marketing)/page.tsx"
git commit -m "feat(marketing): compose landing page + logged-in redirect"
```

---

## Task 15: Legal placeholder routes

Spec §8: minimal `/privacy` and `/terms` so footer links resolve.

**Files:**
- Create: `app/(marketing)/privacy/page.tsx`
- Create: `app/(marketing)/terms/page.tsx`

- [ ] **Step 1: Create the privacy page**

```tsx
// app/(marketing)/privacy/page.tsx
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy · GT Vault" };

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-20">
      <h1 className="text-3xl font-bold text-neutral-100">Privacy Policy</h1>
      <p className="mt-4 text-neutral-400">
        GT Vault stores the GTA V assets you choose to track, tied to your
        account. We don&apos;t sell your data. A full privacy policy will be
        published here before public launch.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Create the terms page**

```tsx
// app/(marketing)/terms/page.tsx
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms · GT Vault" };

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-20">
      <h1 className="text-3xl font-bold text-neutral-100">Terms of Use</h1>
      <p className="mt-4 text-neutral-400">
        GT Vault is a free, fan-made tool provided as-is, and is not affiliated
        with Rockstar Games or Take-Two Interactive. Full terms will be
        published here before public launch.
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Verify + commit**

Run: `npm run typecheck`
Expected: exits 0.
```bash
git add "app/(marketing)/privacy/page.tsx" "app/(marketing)/terms/page.tsx"
git commit -m "feat(marketing): add privacy + terms placeholder pages"
```

---

## Task 16: SEO metadata + Open Graph

Spec §8. The root `app/layout.tsx` already sets a base title/description; here we set the marketing landing page's own metadata + OG image reference.

**Files:**
- Modify: `app/(marketing)/page.tsx` (add `metadata` export)
- Create: `public/marketing/og.webp` (placeholder now; final image in Task 17)

- [ ] **Step 1: Add metadata export to the page**

Add this above `export default async function HomePage()` in `app/(marketing)/page.tsx`:

```tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "GT Vault — Track your entire GTA V empire",
  description:
    "Track your full GTA V asset portfolio — vehicles, properties, businesses, aircraft and boats — and see your net worth. Free to use.",
  openGraph: {
    title: "GT Vault — Track your entire GTA V empire",
    description:
      "Your full GTA V portfolio and its net worth, in one place. Free to use.",
    url: "https://www.gtvault.app",
    siteName: "GT Vault",
    images: [{ url: "/marketing/og.webp", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "GT Vault — Track your entire GTA V empire",
    description:
      "Your full GTA V portfolio and its net worth, in one place. Free to use.",
    images: ["/marketing/og.webp"],
  },
};
```

- [ ] **Step 2: Create a placeholder OG image**

Run:
```bash
cp public/logo-mark.png public/marketing/og.webp
```
Expected: no output.

- [ ] **Step 3: Verify + commit**

Run: `npm run typecheck && npm run lint`
Expected: exits 0.
```bash
git add "app/(marketing)/page.tsx" public/marketing/og.webp
git commit -m "feat(marketing): add SEO metadata + OG image"
```

---

## Task 17: Capture real screenshots

Spec §6. Replace the placeholder images with real captures from James's loaded account. This is a manual/tooling task done with the dev server running and a logged-in session.

**Files:**
- Replace: `public/marketing/dashboard.webp`, `vehicles.webp`, `property.webp`, `organizer.webp`
- Create/replace: `public/marketing/og.webp`

- [ ] **Step 1: Start the dev server**

Run: `npm run dev` (leave running).

- [ ] **Step 2: Capture each screen**

With a logged-in session on James's account, capture (using the run/verify browser tooling, viewport 1600×900, dark mode):
- `/dashboard` → save as `dashboard.webp`
- `/vehicles` → save as `vehicles.webp`
- a property detail (open a loaded property) → save as `property.webp`
- `/organize` (the AI Organizer, showing a plan) → save as `organizer.webp`

Normalize each to WebP at the dimensions declared in the components (`dashboard` 1600×900; others 1200×800/900) using the existing `sharp` dependency. Save into `public/marketing/`.

- [ ] **Step 3: Produce the OG image**

Create a 1200×630 WebP for `public/marketing/og.webp` — the lockup on the `#0a0a0a` background with the tagline "Track your entire GTA V empire". Generate via a one-off `sharp` script (composite lockup + text) or export from the hero.

- [ ] **Step 4: Visual check**

Reload `http://localhost:3000/`. Expected: real screenshots render in hero, organizer spotlight, and showcase; no layout shift (dimensions already declared).

- [ ] **Step 5: Commit**

```bash
git add public/marketing/
git commit -m "feat(marketing): add real app screenshots + OG image"
```

---

## Task 18: Final verification + merge

- [ ] **Step 1: Full check**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: all exit 0; build completes (this catches RSC/client boundary and image issues).

- [ ] **Step 2: Responsive + reduced-motion pass**

In `npm run dev`: check 375px, 768px, 1440px widths — no horizontal scroll, mobile menu works, sections stack cleanly. Confirm contrast of green-on-dark text and that the page reads correctly.

- [ ] **Step 3: Merge to main**

```bash
git checkout main
git merge --no-ff feat/marketing-landing -m "feat(marketing): GT Vault landing page"
git push origin main
```

- [ ] **Step 4: Post-deploy check**

After Vercel deploys, visit `https://www.gtvault.app/` logged out (landing renders) and logged in (redirects to `/dashboard`). Send the link in a chat to confirm the OG card renders.

---

## Notes / Out of Scope (from spec §9)

- Stripe / Pro purchase flow — deferred; pricing is a soft teaser only.
- **Disabling the AI Organizer in-app** — separate follow-up task (memory: `project_disable_organizer_followup`). NOT part of this plan, but should be done before sharing the site widely so signups can't run up API costs.
- Additional marketing pages (`/features`, `/about`) — bolt on later.
- Full legal copy — placeholder routes only.
