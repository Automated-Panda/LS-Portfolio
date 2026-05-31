# GT Vault — Marketing Landing Page Design

**Date:** 2026-05-31
**Status:** Approved design, ready for implementation plan
**Owner:** James

---

## 1. Purpose & Context

GT Vault (a GTA V asset tracker) needs a public marketing landing page so James can
direct friends to the site, have them sign up, and start using the app — while app
development is paused. The app itself is functional but unfinished; the site's job is
to look legitimate and convert visitors to signups.

- **Primary goal:** drive open signups (no waitlist gate).
- **Audience:** James's friends — GTA players who already get the concept.
- **Architecture (already decided):** path-based on a single domain. Marketing lives
  at `gtvault.app/` via the existing `app/(marketing)/` route group; the app stays at
  `/dashboard`, `/vehicles`, etc. via `app/(app)/`. No subdomain. Auth stays on
  `www.gtvault.app` exactly as configured.
- **Scope:** a single landing page now. Future pages (`/features`, `/about`) can be
  bolted on later as new files in the `(marketing)` group — out of scope here.

### Success criteria

- A visitor landing on `gtvault.app/` understands what GT Vault is within seconds and
  has an obvious path to sign up.
- The page showcases real app screenshots, reads as a credible product, and works well
  on mobile (375px) through desktop (1440px).
- Logged-in users hitting `/` are redirected straight to `/dashboard`.
- No new runtime dependencies; visual consistency with the existing app.

---

## 2. Hero (locked during brainstorming)

Visual direction: **"C + A" blend** — structured/HUD personality (option C) executed
with premium, calm restraint (option A). Linear/Vercel composure with subtle GTA-HUD
nods, not loud gaming energy.

Hero stack, top to bottom, centered:

1. Eyebrow label: `GTA V ASSET TRACKER` (uppercase, letter-spaced, brand green).
2. Five stars `★★★★★` on their own line directly below the eyebrow (the "wanted level"
   nod — given room, not crammed inline).
3. Headline: **"Track your entire GTA V empire"** (two lines, bold, tight tracking).
4. Subcopy: "Vehicles, properties, businesses, aircraft & boats — your whole portfolio
   and its net worth, in one place." (~40ch, muted.)
5. CTAs: solid green **"Get started free"** (primary) + outline **"See features"**
   (secondary, anchors to the features section).
6. Framed real dashboard screenshot below, with a subtle green-glow shadow.

Top nav: GT Vault lockup (left); Features, FAQ, Sign in, and a green "Get started"
button (right).

---

## 3. Section Order (locked)

Top to bottom:

1. **Hero** — as above.
2. **Stat bar** — thin band of big numbers signaling comprehensive data
   (e.g. "800+ vehicles · 220+ properties · every business"). Exact figures pulled
   from the live catalog at build time (see §6).
3. **Core features** — 3–4 cards (icon + title + one line): Track everything ·
   Net worth · Catalog coverage · Storage management.
4. **AI Organizer spotlight** — own section, framed as **"Pro · Coming soon"** (the
   flagship paid feature). Screenshot + example prompt ("Put all my sports cars in
   Eclipse Towers" → it plans & does it). Clearly not-yet-available — builds desire,
   primes the freemium model. See §5.
5. **Screenshot showcase** — 2–3 real app shots in alternating image/text rows
   (vehicles browse, property detail, dashboard).
6. **Pricing teaser** — soft "Free to use. Pro coming soon." Sets the freemium
   expectation without a real purchase flow (Stripe isn't built). Kept minimal.
7. **FAQ** — five questions (see §4).
8. **Final CTA** — large "Start tracking your empire" + repeat primary button.
9. **Footer** — lockup, nav links, privacy/terms (placeholder routes), and the
   Rockstar disclaimer.

---

## 4. FAQ Content (locked)

1. **Is it free?** — Yes, free to use. A Pro tier (including the AI Organizer) is coming.
2. **Is this affiliated with Rockstar / Take-Two?** — No. GT Vault is fan-made and
   unofficial, not affiliated with or endorsed by Rockstar Games. (Important legal cover.)
3. **Does it connect to my GTA account / sync automatically?** — No. You track your
   assets manually; there is no Rockstar API. (Sets expectations.)
4. **What platforms does it cover?** — GTA V / GTA Online (data is universal across
   PC and console).
5. **Is my data safe?** — Brief reassurance: account-based, your portfolio is private
   to you.

---

## 5. AI Organizer — "Pro · Coming soon"

The Organizer calls the Anthropic API, which costs James real money per run. There is
no paywall yet (Stripe/Pro tier unbuilt), so it must not be freely usable at launch.

- **On the site:** present it as the marquee **Pro** feature with a "Coming soon"
  badge. Showcase its value (natural-language plan-and-apply) without claiming it's
  available now.
- **In the app (separate follow-up, NOT part of this spec):** disable/gate the
  `/organize` route + hide its sidebar nav entry before the friends launch, so signups
  can't run up API costs. Tracked as its own task (see memory:
  `project_disable_organizer_followup`). The site copy stays truthful because the
  feature is genuinely gated.

---

## 6. Real Screenshots

Screenshots are captured from the **real app against James's loaded account** at build
time (not mocked), using the run/verify tooling to launch the dev server, sign in, and
navigate. Captured screens: dashboard (hero), vehicles browse, a property detail, and
the AI Organizer (for the Pro spotlight — shown as a teaser).

- Build-time task, not part of the design. Requires dev server + a logged-in session.
- Normalize to web-optimized formats (WebP), with declared dimensions to avoid layout
  shift, real descriptive alt text, and lazy-loading below the fold.
- Exact stat-bar numbers (§3.2) are read from the live catalog counts at build time so
  they are accurate, not guessed.

---

## 7. Design System (approved)

Reuses the app's existing Tailwind theme + shadcn/ui — no new runtime dependencies —
so the marketing site and app are visually consistent.

- **Color (semantic dark tokens):** bg `#0a0a0a`, surface `#101010`, border `#222`,
  brand green `#84cc16`, text `#f5f5f5`, muted `#a3a3a3`. Green-on-near-black is
  ~11:1 contrast (passes WCAG AA/AAA). Green used as accent + exactly one primary CTA
  per section.
- **Typography:** Anton/Impact display for eyebrow labels and the lockup (used
  sparingly for punch); bold system sans for headings; system sans body at 16px base,
  1.5–1.6 line-height, ~60–70 character measure.
- **Components:** the app's existing shadcn/ui `Button` and `Card` primitives; Lucide
  icons (no emoji as structural icons); 8px spacing rhythm; radius ~7–12px; a subtle
  green-glow shadow reserved for the hero screenshot only.
- **Motion & accessibility:** quiet scroll-entrance fades (150–300ms, transform/opacity
  only) that honor `prefers-reduced-motion`; 1–2 animated elements per section, no
  decorative motion. Real alt text on every screenshot, full keyboard navigation,
  mobile-first responsive (375 → 768 → 1024 → 1440).

---

## 8. Architecture & Components

Built within the existing `app/(marketing)/` route group.

- **Shared marketing chrome:** `app/(marketing)/layout.tsx` provides the marketing
  header (lockup + nav + Get started) and footer (links, privacy/terms, Rockstar
  disclaimer). Future marketing pages inherit this for free.
- **Landing page:** `app/(marketing)/page.tsx` composes the sections in order.
- **Section components:** each section is its own focused, presentational component
  (e.g. `hero`, `stat-bar`, `feature-cards`, `organizer-spotlight`, `screenshot-showcase`,
  `pricing-teaser`, `faq`, `final-cta`) under a marketing components folder, so each
  has one clear purpose and can be edited independently.
- **Logged-in redirect:** the marketing root redirects authenticated users to
  `/dashboard` (server-side check), so returning users skip marketing while anonymous
  visitors see it.
- **Legal routes:** minimal placeholder `/privacy` and `/terms` pages in the
  `(marketing)` group so footer links resolve (content can be filled later).
- **SEO:** page metadata (title, description) and an Open Graph image for link sharing
  in GTA communities.

---

## 9. Out of Scope

- Stripe / Pro purchase flow (deferred — pricing is a soft teaser only).
- Disabling the AI Organizer in-app (separate follow-up task).
- Additional marketing pages (`/features`, `/about`) — bolt on later.
- Full legal copy for privacy/terms (placeholder routes only for now).
- A waitlist (open signups, no gate).

---

## 10. Open Items for Implementation

- Confirm exact stat-bar numbers from live catalog counts at build time.
- Capture and normalize the real screenshots (dashboard, vehicles, property, organizer).
- Produce the Open Graph image.
