# Hybrid Entities — Design Spec (2026-06-06)

Modelling GTA Online entities that are simultaneously a **vehicle** and a
**storage container** for other vehicles: the **Terrorbyte**, **Mobile
Operations Center (MOC)**, **Kosatka**, and the **Acid Lab** (Brickade 6x6).
The note that kicked this off lives in `docs/notes.md` (🧩 Hybrid
vehicle/business storage entities).

## Goal

Let users track ownership of these container vehicles, the **upgrades** installed
on them, and the **other vehicles stored inside them** — using the app's existing
vehicle-centric mental model.

## Decisions (locked in brainstorming)

1. **Approach A — vehicle-primary + nesting.** These stay **vehicles** (they
   already exist in the vehicle catalogue, and the player drives them). They gain
   a storage capability and an upgrade subsystem, rather than being modelled as
   properties or dual records.
2. **Storage + upgrades only — no business/income.** The app does not track
   product, sell missions, or income anywhere, so the "it's also a business"
   nature is dropped. The Acid Lab is "the Brickade 6x6 with upgrades that stores
   the Acid bike," not an income source.
3. **Full upgrades.** Model all notable upgrades for the MOC, Terrorbyte, and
   Kosatka (workshops, weapons, sonar, moon pool, equipment, supplies) — not just
   storage-gating ones. This requires a new **vehicle-upgrades subsystem**
   mirroring the existing property-upgrades machinery.
4. **Nesting is one level deep.** A vehicle can be stored inside a container
   vehicle; the container itself sits in a property (or is independent). No
   container-in-container.
5. **Freakshop is added** as a minimal property — the Acid Lab's home (parallels
   Terrorbyte → Nightclub).

## Out of scope

- Income / product / sell-mission tracking.
- Weapon stats, cosmetic livery catalogues, MOC/Avenger cross-compatibility
  trivia.
- Nesting deeper than one level.

## Data model

One migration adds three things; everything mirrors the property equivalents so
existing patterns and helpers carry over.

### 1. Nesting column

```sql
alter table public.user_owned_vehicles
  add column if not exists stored_in_vehicle_id uuid
    references public.user_owned_vehicles(id) on delete set null;
```

- A vehicle nested in a container records `stored_in_vehicle_id` + reuses the
  existing **`sub_slot`** text column to name the bay (e.g. "Sparrow",
  "Kraken Avisa", "Oppressor Mk II", "Vehicle Bay 1").
- **Mutually exclusive** with `stored_in_property_id` — enforced in the
  assignment server action (a vehicle is either in a property or in a container,
  never both). A nested vehicle never gets a numbered garage slot.

### 2. `vehicle_upgrades` (catalogue) — mirrors `property_upgrades`

```
id text pk, vehicle_id text fk→vehicles,
display_name text, capacity int default 0,
sub_slots jsonb null,           -- same shape as property_upgrades.sub_slots
required_upgrade_id text null, mutex_group text null,
included_on_purchase bool default false, price bigint null, sort_order int
```

- **Storage bays** are `sub_slots` carrying `vehicle_id` / `vehicle_ids`
  bindings (reuse `lib/bays.ts` helpers verbatim).
- Non-storage upgrades (weapons, sonar, supplies) have `capacity = 0`,
  `sub_slots = null`.

### 3. `user_owned_vehicle_upgrades` — mirrors `user_owned_property_upgrades`

```
id uuid pk, user_owned_vehicle_id uuid fk→user_owned_vehicles (cascade),
vehicle_upgrade_id text fk→vehicle_upgrades (cascade),
unique (user_owned_vehicle_id, vehicle_upgrade_id)
```

RLS: owner-only via the parent `user_owned_vehicles` row (copy the
`user_owned_property_upgrades` policies).

## Catalogue data

Storable-vehicle ids confirmed present: `oppressor2`, `avisa`, `manchez2`
(Manchez Scout C = Acid bike). **Build-time TODOs:** confirm the Sparrow's id
(display "Sparrow" exists; id ≠ "sparrow"); the **MOC needs a catalogue vehicle
row added** (cabs `mule4`/`hauler2` exist but not the MOC unit itself).

| Container | Storage bays (incl. = always present) | Notable non-storage upgrades | Home |
|---|---|---|---|
| **Terrorbyte** | Oppressor Mk II (`oppressor2`) — *incl.* | Specialized Workshop, Drone Station, Scanner, Weapon Workshop | Nightclub / Garment Factory |
| **MOC** (new row) | Vehicle Bay ×2 — *gated by* **Vehicle Workshop** | Weapon Workshop, Command Centre; cab choice = mutex cosmetic group | Bunker |
| **Kosatka** (`kosatka`) | Sparrow + Kraken Avisa (`avisa`) — *incl. (Moon Pool)* | Sonar Station, Guided Missiles, Weapon Systems | independent |
| **Acid Lab** (`brickade2`) | Acid bike (`manchez2`) — *incl.* | Equipment Upgrade, Supplies | **Freakshop** (new property) |

Container vehicles are identified client-side via a small **`lib/containers.ts`**
catalogue map (mirrors `lib/bays.ts`): which vehicle ids are containers, and
which bay accepts which stored vehicle. Server-side, "is a container" is equally
derivable from the presence of storage-bearing `vehicle_upgrades`, but the map is
the single client-safe source of truth for reasoning without a DB round-trip.

**Freakshop**: a new property — subtype `freakshop`, **`property_type` =
`special`**, `counts_as_garage` false, `base_capacity` 0. It is simply the Acid
Lab's parent location; the Acid Lab (a container vehicle) is assigned there via
`stored_in_property_id`, and the Acid bike nests in the Acid Lab.

## Queries

A new `getOwnedContainerVehicles(userId)` (or an extension of the existing
instance query) returns, per owned container vehicle: its installed upgrades and
its storage bays with the nested vehicles — mirroring
`getOwnedPropertiesWithStorage`. The nested vehicles are ordinary
`OwnedVehicleInstance`s whose `stored_in_vehicle_id` points at the container.

## UI

- **Container management** lives in the vehicle's `InstanceDrawer`, extended with
  a mini `PropertyDetail`-style panel: an **upgrades checklist** (reuse the
  `UpgradeChecklist` + `usePropertyUpgrades` patterns, vehicle-flavoured) and the
  **storage bays** (each a vehicle-bound slot with add/remove of the nested
  vehicle, reusing the bay UI from `property-detail.tsx`).
- **Child side**: a storable vehicle (Oppressor Mk II, Avisa, Acid bike, Sparrow)
  can select its container in the storage dropdown, alongside properties. The
  dropdown lists owned containers whose bays accept that vehicle (reuse the
  bay-binding filter logic from `instance-drawer.tsx`).
- **Badges** on `/my-vehicles`: a container shows `📦 stores N/M`; a nested
  vehicle shows `📍 in «Kosatka»` instead of a garage location.

## Integration

- **Numbered slots**: container vehicles are not garages → excluded from the
  slot grid; nested vehicles never get a `slot_number`.
- **Organizer**: container vehicles and nested vehicles are treated like
  bay-bound vehicles — never auto-moved into normal garages (extend the
  `lib/organizer/planner.ts` + `portfolio-context.ts` exclusions).
- **Dashboard / needs-attention**: a stored bike that's nested counts as
  "stored"; an owned-but-unstored storable special is surfaced sensibly (reuse
  the `lib/pegasus.ts` classification, extended for containers).

## Phasing

This is effectively the property storage+upgrade subsystem rebuilt for vehicles,
so it ships in checkpoints rather than one sitting:

1. **Schema + catalogue** — migration (3 changes) + `vehicle_upgrades` rows +
   storage bays for all four + Freakshop property + MOC catalogue row.
2. **Query layer** — `getOwnedContainerVehicles` + thread `stored_in_vehicle_id`
   through the instance query; a `lib/containers.ts` helper.
3. **UI** — InstanceDrawer container panel (upgrades + bays) and child-side
   nesting in the storage dropdown; card badges.
4. **Integration** — slot exclusion, Organizer awareness, dashboard, tests.

Each phase ends green (tsc + vitest + build) and is independently reviewable.

## Testing

- Pure helpers: `lib/containers.ts` (which vehicles are containers, which bay
  accepts which vehicle) — Vitest, mirroring `lib/bays.ts` usage in tests.
- Capacity/nesting validation in the assignment action (mutual exclusivity;
  bay capacity; bay vehicle-binding).
- Organizer planner test: a container vehicle and its nested vehicle are never
  moved to a normal garage.

## Build-time TODOs / open questions

- Confirm the **Sparrow** vehicle id.
- Add the **MOC** catalogue vehicle row (class + price + image); decide whether
  the cab choice (Mule/Hauler/Pounder/Phantom Custom) is a mutex cosmetic upgrade
  group or omitted for v1.
- Source images for Freakshop + MOC.
- Confirm Terrorbyte home options (Nightclub and/or Garment Factory) and whether
  to constrain the container's parent property by binding (like bays) or leave it
  free in v1.
