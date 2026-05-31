# Hangar Capacity Boost (McKenzie + GTA+) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Owning the McKenzie Field Hangar boosts the player's regular Hangar from 20 to 35 aircraft (40 with GTA+), applied consistently in both the display and the storage-enforcement layers; users declare GTA+ on their profile.

**Architecture:** First restructure the regular Hangar so its 20 slots are `base_capacity` (dropping the storage upgrade, mirroring the Vehicle Warehouse change). Then add a `gta_plus` flag to profiles + a profile toggle, and a single pure helper `lib/hangar-boost.ts`. Apply that helper at two boundaries that must agree: `getOwnedPropertiesWithStorage` (display) and `capacityForStorageLocation` (enforcement).

**Tech Stack:** Next.js 15 (App Router, RSC, server actions), Supabase (Postgres), TypeScript, Tailwind/shadcn-ui, Zod.

---

## Conventions for this plan

- **No unit-test runner exists.** "Verify" = `npm run typecheck`, `npm run validate` (seed), `npm run build`, and stated manual checks. Do NOT add a test framework.
- **`npm run lint` is broken** in this repo (no ESLint config → interactive hang). Do NOT run it.
- **Branch:** do all work on `feat/hangar-boost` (created in Task 0). Commit after each task with the message in its Commit step. Do not push until Task 11.
- **Live DB writes:** several tasks run one-off `tsx --env-file=.env.local` scripts against the hosted Supabase (service-role). This is the established pattern (see the McKenzie/agency fixes). Each such script is created, run once, then deleted in the same task.
- **Boost amounts:** McKenzie owned → +15; McKenzie owned AND GTA+ → +20; else +0. Applies only to a regular Hangar's base storage.

---

## File Structure

- `scripts/data/hangars-seed.ts` — MODIFY: 20 → `base_capacity`, drop the storage upgrade.
- `data/seed/properties.json` — MODIFY: same, for all 5 hangar rows (generated output).
- `supabase/migrations/0023_add_gta_plus.sql` — CREATE: `profiles.gta_plus` column.
- `lib/hangar-boost.ts` — CREATE: pure boost helper + per-user context fetch.
- `lib/capacity.ts` — MODIFY: apply boost in the base-storage branch (enforcement).
- `lib/queries/my-properties.ts` — MODIFY: apply boost to hangar `base_capacity` (display).
- `app/(app)/profile/page.tsx` — MODIFY: read + pass `gta_plus`.
- `app/(app)/profile/profile-form.tsx` — MODIFY: GTA+ checkbox.
- `app/(app)/profile/actions.ts` — MODIFY: persist `gta_plus`.
- `components/portfolio/property-drawer.tsx` — MODIFY: McKenzie "boosts your Hangar" line.

---

## Task 0: Branch setup

- [ ] **Step 1: Create branch**

Run:
```bash
git checkout -b feat/hangar-boost
```
Expected: `Switched to a new branch 'feat/hangar-boost'`

- [ ] **Step 2: Baseline check**

Run: `npm run typecheck`
Expected: exits 0.

---

## Task 1: Restructure Hangar storage onto base_capacity (seed)

Move the 20 slots from the `Hangar Storage` upgrade to `base_capacity`, and drop that upgrade (keep Aircraft Workshop). Mirrors the Vehicle Warehouse restructure.

**Files:**
- Modify: `scripts/data/hangars-seed.ts`
- Modify: `data/seed/properties.json`

- [ ] **Step 1: Edit the hangar seed builder**

In `scripts/data/hangars-seed.ts`, replace the `buildHangar` function body's `capacity` + `upgrades` so capacity is 20 and only the workshop upgrade remains:

```ts
function buildHangar(loc: LocationSeed): Omit<Property, "image_path"> {
  return {
    id: loc.id,
    display_name: loc.display_name,
    property_type: "business",
    subtype: "hangar",
    subtype_display: "Hangar",
    location: loc.address,
    neighborhood: loc.neighborhood,
    // 20 aircraft slots come with every hangar — modeled as base_capacity
    // (not a storage upgrade). Boosted to 35/40 when the player also owns the
    // McKenzie Field Hangar (see lib/hangar-boost.ts).
    capacity: 20,
    counts_as_garage: false,
    upgrades: [
      {
        id: `${loc.id}-workshop`,
        display_name: "Aircraft Workshop",
        tier: null,
        capacity: 0,
        required_upgrade_id: null,
        notes: "Enables aircraft customization / respraying ($1,150,000).",
      },
    ],
    _sources: {
      fandom: "https://gta.fandom.com/wiki/Hangar",
      gtabase: null,
    },
    ...(loc.verify ? { verify: true } : {}),
  };
}
```

- [ ] **Step 2: Edit the generated JSON for all 5 hangars**

In `data/seed/properties.json`, for each of the 5 rows with `"subtype": "hangar"` (ids: `hangar-lsia-a17`, `hangar-lsia-1`, `hangar-fort-zancudo-3497`, `hangar-fort-zancudo-3499`, `hangar-fort-zancudo-a2`): set `"capacity": 20` (was `0`) and remove the `*-storage` upgrade object from that row's `upgrades` array (keep the `*-workshop` object). Example for `hangar-lsia-a17` — the `upgrades` array becomes:

```json
    "upgrades": [
      {
        "id": "hangar-lsia-a17-workshop",
        "display_name": "Aircraft Workshop",
        "tier": null,
        "capacity": 0,
        "required_upgrade_id": null,
        "notes": "Enables aircraft customization / respraying ($1,150,000).",
        "price": 1150000
      }
    ],
```
and that row's top-level `"capacity": 0` becomes `"capacity": 20`. Repeat for all 5. Leave McKenzie (`mckenzie-field-hangar`, subtype `mckenzie-hangar`) untouched — it already has 0 capacity and no storage upgrade.

- [ ] **Step 3: Validate the seed**

Run: `npm run validate`
Expected: `Errors: 0`, `validate: OK`.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add scripts/data/hangars-seed.ts data/seed/properties.json
git commit -m "refactor(data): Hangar 20 slots as base_capacity, drop storage upgrade"
```

---

## Task 2: Apply the Hangar restructure to the live DB

The hosted DB has the old rows (capacity 0 + a storage upgrade with parked aircraft). `capacity` is a curated column (import-seed preserves it), so update directly. Dropping the storage upgrade sets any parked aircraft's `assigned_upgrade_id` to null (ON DELETE SET NULL) — they fall back to the hangar's base storage automatically.

**Files:**
- Create (temporary): `scripts/fix-hangar-base-capacity.ts`

- [ ] **Step 1: Create the one-off script**

```ts
// scripts/fix-hangar-base-capacity.ts
/**
 * One-off: move the regular Hangar's 20 aircraft slots from the storage upgrade
 * to base_capacity, and delete the storage upgrade rows. Parked aircraft
 * (assigned_upgrade_id -> NULL via ON DELETE SET NULL) fall back to base
 * storage, staying in the same hangar. capacity is curated so set it directly.
 * Run: npx tsx --env-file=.env.local scripts/fix-hangar-base-capacity.ts
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  if (!url || !key) {
    console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data: cap, error: capErr } = await supabase
    .from("properties")
    .update({ capacity: 20 })
    .eq("subtype", "hangar")
    .select("id, capacity");
  if (capErr) { console.error("capacity update failed:", capErr); process.exit(1); }

  const { data: del, error: delErr } = await supabase
    .from("property_upgrades")
    .delete()
    .like("id", "hangar-%-storage")
    .select("id");
  if (delErr) { console.error("storage-upgrade delete failed:", delErr); process.exit(1); }

  console.log(`Set capacity=20 on ${cap?.length ?? 0} hangars:`, cap?.map((r) => r.id));
  console.log(`Deleted ${del?.length ?? 0} storage upgrade rows:`, del?.map((r) => r.id));
}

main();
```

- [ ] **Step 2: Run it**

Run: `npx tsx --env-file=.env.local scripts/fix-hangar-base-capacity.ts`
Expected: logs `Set capacity=20 on 5 hangars` and `Deleted 5 storage upgrade rows`. (Numbers may be lower if some rows were already changed — re-running is safe/idempotent.)

- [ ] **Step 3: Delete the one-off script**

Run: `Remove-Item scripts/fix-hangar-base-capacity.ts`

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(db): migrate live hangars to base_capacity (one-off, applied)"
```
(The commit records the script's removal; it's already run against the DB.)

---

## Task 3: Add gta_plus column migration

**Files:**
- Create: `supabase/migrations/0023_add_gta_plus.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Adds a GTA+ membership flag to profiles. Drives GTA+-dependent perks
-- (currently the larger McKenzie -> Hangar capacity boost: +20 vs +15).
alter table public.profiles
  add column if not exists gta_plus boolean not null default false;
```

- [ ] **Step 2: Apply to the hosted DB**

Apply via the Supabase MCP plugin (or paste into the Studio SQL editor). Verify the column exists:
- Expected: `profiles` now has a `gta_plus boolean not null default false` column.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0023_add_gta_plus.sql
git commit -m "feat(db): add profiles.gta_plus flag"
```

---

## Task 4: Boost helper (single source of truth)

**Files:**
- Create: `lib/hangar-boost.ts`

- [ ] **Step 1: Create the helper**

```ts
// lib/hangar-boost.ts
import { createClient } from "@/lib/supabase/server";

/** Ownership group of the regular, capacity-bearing Hangar. */
export const HANGAR_OWNERSHIP_GROUP = "hangar";

/** Catalogue id of the McKenzie Field Hangar (the boost unlock). */
export const MCKENZIE_PROPERTY_ID = "mckenzie-field-hangar";

/**
 * Extra aircraft slots McKenzie adds to a regular Hangar.
 * Owns McKenzie + GTA+ -> +20; owns McKenzie only -> +15; else 0.
 */
export function hangarBoostSlots(ownsMckenzie: boolean, gtaPlus: boolean): number {
  if (!ownsMckenzie) return 0;
  return gtaPlus ? 20 : 15;
}

/**
 * Effective capacity for a storage location. The boost applies ONLY to a
 * regular hangar's base storage (assignedUpgradeId == null on an
 * ownership_group === "hangar" property). Everything else is unchanged.
 */
export function applyHangarBoost(opts: {
  ownershipGroup: string;
  assignedUpgradeId: string | null;
  baseCapacity: number;
  ownsMckenzie: boolean;
  gtaPlus: boolean;
}): number {
  const isHangarBase =
    opts.ownershipGroup === HANGAR_OWNERSHIP_GROUP &&
    opts.assignedUpgradeId == null;
  if (!isHangarBase) return opts.baseCapacity;
  return opts.baseCapacity + hangarBoostSlots(opts.ownsMckenzie, opts.gtaPlus);
}

/** Per-user inputs to the boost. Two cheap lookups. */
export type HangarBoostContext = { ownsMckenzie: boolean; gtaPlus: boolean };

export async function getHangarBoostContext(
  userId: string,
): Promise<HangarBoostContext> {
  const supabase = await createClient();
  const [mck, prof] = await Promise.all([
    supabase
      .from("user_owned_properties")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("property_id", MCKENZIE_PROPERTY_ID),
    supabase.from("profiles").select("gta_plus").eq("id", userId).maybeSingle(),
  ]);
  return {
    ownsMckenzie: (mck.count ?? 0) > 0,
    gtaPlus: prof.data?.gta_plus ?? false,
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: exits 0 (helper unused so far — fine).

- [ ] **Step 3: Commit**

```bash
git add lib/hangar-boost.ts
git commit -m "feat(hangar): add pure boost helper + per-user context"
```

---

## Task 5: Apply boost in the display layer

`getOwnedPropertiesWithStorage` builds each owned property. Boost the hangar's `base_capacity` here so every UI consumer (cards, drawer, dashboard) shows the right number.

**Files:**
- Modify: `lib/queries/my-properties.ts`

- [ ] **Step 1: Import the helper + context**

At the top of `lib/queries/my-properties.ts`, add after the existing import:

```ts
import { applyHangarBoost, getHangarBoostContext } from "@/lib/hangar-boost";
```

- [ ] **Step 2: Fetch the boost context once**

In `getOwnedPropertiesWithStorage`, after `const supabase = await createClient();`, add:

```ts
  const boost = await getHangarBoostContext(userId);
```

- [ ] **Step 3: Apply the boost to the mapped base_capacity**

In the `.map((row: Row) => { ... })` return object, the `base_capacity` field is currently:

```ts
      base_capacity: p?.capacity ?? 0,
```
Replace it with:

```ts
      base_capacity: applyHangarBoost({
        ownershipGroup: p?.ownership_group ?? "",
        assignedUpgradeId: null,
        baseCapacity: p?.capacity ?? 0,
        ownsMckenzie: boost.ownsMckenzie,
        gtaPlus: boost.gtaPlus,
      }),
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 5: Manual check (display)**

Run `npm run dev`. As a user who owns a Hangar:
- With McKenzie NOT owned: hangar shows `/ 20`.
- Buy McKenzie (mark owned): hangar drawer + `/my-businesses` card show `/ 35`.
- Toggle GTA+ on (after Task 7) → `/ 40`. (Defer the GTA+ part of this check until Task 7 is done.)

- [ ] **Step 6: Commit**

```bash
git add lib/queries/my-properties.ts
git commit -m "feat(hangar): boost hangar base_capacity in owned-property query (display)"
```

---

## Task 6: Apply boost in the enforcement layer

`capacityForStorageLocation` decides whether an aircraft can actually be parked. Make it agree with the display.

**Files:**
- Modify: `lib/capacity.ts`

- [ ] **Step 1: Import the helper**

At the top of `lib/capacity.ts`, after the existing import:

```ts
import { applyHangarBoost, getHangarBoostContext } from "@/lib/hangar-boost";
```

- [ ] **Step 2: Boost the base-storage branch**

In `capacityForStorageLocation`, the base-storage branch currently is:

```ts
  if (assignedUpgradeId === null) {
    const { data, error } = await supabase
      .from("user_owned_properties")
      .select("properties!inner(capacity)")
      .eq("id", ownedPropertyId)
      .maybeSingle();

    if (error) throw error;
    const p = Array.isArray(data?.properties)
      ? data?.properties[0]
      : data?.properties;
    return p?.capacity ?? 0;
  }
```
Replace it with (also select `ownership_group` and `user_id`, then boost):

```ts
  if (assignedUpgradeId === null) {
    const { data, error } = await supabase
      .from("user_owned_properties")
      .select("user_id, properties!inner(capacity, ownership_group)")
      .eq("id", ownedPropertyId)
      .maybeSingle();

    if (error) throw error;
    const p = Array.isArray(data?.properties)
      ? data?.properties[0]
      : data?.properties;
    const baseCapacity = p?.capacity ?? 0;
    if (p?.ownership_group !== "hangar" || !data?.user_id) return baseCapacity;
    const boost = await getHangarBoostContext(data.user_id);
    return applyHangarBoost({
      ownershipGroup: p.ownership_group,
      assignedUpgradeId: null,
      baseCapacity,
      ownsMckenzie: boost.ownsMckenzie,
      gtaPlus: boost.gtaPlus,
    });
  }
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 4: Manual check (enforcement)**

With a Hangar + McKenzie owned, in `npm run dev` open the hangar's storage picker and confirm you can add aircraft beyond 20 (up to 35), i.e. no "Over capacity" error before 35. Without McKenzie, adding the 21st aircraft is rejected.

- [ ] **Step 5: Commit**

```bash
git add lib/capacity.ts
git commit -m "feat(hangar): boost hangar base capacity in enforcement (capacityForStorageLocation)"
```

---

## Task 7: GTA+ toggle on the profile

**Files:**
- Modify: `app/(app)/profile/actions.ts`
- Modify: `app/(app)/profile/profile-form.tsx`
- Modify: `app/(app)/profile/page.tsx`

- [ ] **Step 1: Persist gta_plus in the action**

In `app/(app)/profile/actions.ts`, extend the zod schema and the update. The schema becomes:

```ts
const schema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters.")
    .max(30, "Username must be 30 characters or fewer.")
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      "Letters, numbers, underscores, and hyphens only.",
    ),
  displayName: z
    .string()
    .max(60, "Display name must be 60 characters or fewer.")
    .optional(),
  gtaPlus: z.boolean(),
});
```
Update the `safeParse` call to include `gtaPlus` (an HTML checkbox sends `"on"` when checked, nothing when unchecked):

```ts
  const parsed = schema.safeParse({
    username: formData.get("username"),
    displayName: formData.get("displayName") || undefined,
    gtaPlus: formData.get("gtaPlus") === "on",
  });
```
And the DB update object becomes:

```ts
    .update({
      username: parsed.data.username,
      display_name: parsed.data.displayName ?? null,
      gta_plus: parsed.data.gtaPlus,
    })
```

- [ ] **Step 2: Add the checkbox to the form**

In `app/(app)/profile/profile-form.tsx`, extend `Props` and add the field. Props becomes:

```ts
type Props = {
  email: string;
  username: string;
  displayName: string;
  gtaPlus: boolean;
};
```
The function signature becomes `export function ProfileForm({ email, username, displayName, gtaPlus }: Props) {`. Then add this block just before the `{state.error && (` block:

```tsx
      <div className="flex items-start gap-3 rounded-md border p-3">
        <input
          id="gtaPlus"
          name="gtaPlus"
          type="checkbox"
          defaultChecked={gtaPlus}
          className="mt-1 h-4 w-4 accent-[#84cc16]"
        />
        <div className="space-y-0.5">
          <Label htmlFor="gtaPlus">GTA+ member</Label>
          <p className="text-xs text-muted-foreground">
            Unlocks GTA+ perks — e.g. the larger McKenzie hangar boost (+20 vs +15 aircraft slots).
          </p>
        </div>
      </div>
```

- [ ] **Step 3: Pass gta_plus from the page**

In `app/(app)/profile/page.tsx`, the profile select becomes:

```ts
    supabase
      .from("profiles")
      .select("username, display_name, gta_plus")
      .eq("id", user.id)
      .maybeSingle(),
```
And the `<ProfileForm .../>` gains the prop:

```tsx
          <ProfileForm
            email={user.email ?? ""}
            username={profile?.username ?? ""}
            displayName={profile?.display_name ?? ""}
            gtaPlus={profile?.gta_plus ?? false}
          />
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 5: Manual check**

In `npm run dev`, on `/profile`: the GTA+ checkbox reflects the stored value, toggling + Save persists (reload shows the new state). With a Hangar + McKenzie owned, toggling GTA+ flips the hangar capacity between 35 (off) and 40 (on) on `/my-businesses`.

- [ ] **Step 6: Commit**

```bash
git add "app/(app)/profile/actions.ts" "app/(app)/profile/profile-form.tsx" "app/(app)/profile/page.tsx"
git commit -m "feat(profile): GTA+ membership toggle"
```

---

## Task 8: McKenzie "boosts your Hangar" line in the drawer

McKenzie has 0 storage; show what it actually does instead of an empty storage section.

**Files:**
- Modify: `components/portfolio/property-drawer.tsx`

- [ ] **Step 1: Add an informational note for McKenzie**

In `components/portfolio/property-drawer.tsx`, in the `StorageSection` component (defined at ~line 483; it has `property` in scope and returns `<section>` at ~line 513), immediately after that `<section>` opening tag and before the `{!hasAny ? (` block, add a McKenzie-specific note keyed off subtype:

```tsx
      {property.subtype === "mckenzie-hangar" && (
        <p className="mb-3 rounded-md border border-[#84cc16]/30 bg-[#84cc16]/5 p-3 text-xs text-muted-foreground">
          The McKenzie Field Hangar has no storage of its own. While you own it,
          your Hangar holds <span className="text-[#84cc16]">+15 aircraft</span>{" "}
          (<span className="text-[#84cc16]">+20</span> with GTA+).
        </p>
      )}
```
- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 3: Manual check**

In `npm run dev`, open the McKenzie Field Hangar from `/my-businesses`: it shows the "+15 (+20 GTA+)" note and no "0 / 0 stored" storage row.

- [ ] **Step 4: Commit**

```bash
git add components/portfolio/property-drawer.tsx
git commit -m "feat(hangar): explain McKenzie boost in its drawer (no own storage)"
```

---

## Task 9: Full verification pass

- [ ] **Step 1: Static checks**

Run: `npm run typecheck && npm run validate && npm run build`
Expected: typecheck 0; `validate: OK`; build completes (31+ pages) exit 0.

- [ ] **Step 2: Behavior matrix (manual, `npm run dev`)**

Confirm each, on `/my-businesses` (hangar card), the hangar drawer, and the dashboard capacity total:
- Hangar, no McKenzie → 20; cannot park 21st aircraft.
- Hangar + McKenzie, GTA+ off → 35; can park up to 35.
- Hangar + McKenzie, GTA+ on → 40; can park up to 40.
- McKenzie owned, no Hangar → no capacity anywhere; McKenzie drawer shows the boost note.

- [ ] **Step 3: No commit (verification only).**

---

## Task 10: Update notes

**Files:**
- Modify: `docs/notes.md`

- [ ] **Step 1: Tick the McKenzie/hangar follow-up**

In `docs/notes.md`, find the McKenzie out-of-scope bullet ("McKenzie Field Hangar — ownable in Online since 1.70 …") and append a line under it:

```md
- [x] **Resolved 2026-05-31:** Hangar 20 slots moved to base_capacity; McKenzie modeled as a capacity boost (+15, +20 GTA+) via `lib/hangar-boost.ts`; GTA+ flag added to profiles. Spec/plan in `docs/superpowers/`.
```

- [ ] **Step 2: Commit**

```bash
git add docs/notes.md
git commit -m "docs(notes): record hangar capacity boost work"
```

---

## Task 11: Merge to main

- [ ] **Step 1: Final check**

Run: `npm run typecheck && npm run build`
Expected: both exit 0.

- [ ] **Step 2: Merge + push**

```bash
git checkout main
git merge --no-ff feat/hangar-boost -m "feat(hangar): McKenzie + GTA+ capacity boost"
git push origin main
```

- [ ] **Step 3: Post-deploy check**

After Vercel deploys, on the live site (logged in): own a Hangar + McKenzie, toggle GTA+, confirm 35 ↔ 40 and that parking aircraft past 20 works.

---

## Notes / Out of Scope (from spec §8)

- No other cross-property capacity perks (Vinewood Club Storage, GTA+ vehicle storage).
- No auto-eviction when capacity shrinks below current occupancy (over-cap display tolerated; only new adds blocked).
- No general derived-capacity "engine" — one focused helper for the one documented case.
