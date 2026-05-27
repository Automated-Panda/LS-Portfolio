import { z } from "zod";

export const ManufacturerSchema = z.object({
  display: z.string().min(1),
  country: z.string().nullable(),
});
export const ManufacturersFileSchema = z.record(z.string(), ManufacturerSchema);

export const TagRuleSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("fandom_category"), category: z.string().min(1) }),
  z.object({ type: z.literal("manual"), vehicle_ids: z.array(z.string()) }),
]);

export const TagSchema = z.object({
  display: z.string().min(1),
  rule: TagRuleSchema,
});
export const TagsFileSchema = z.record(z.string(), TagSchema);

export const VehicleSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  internal_name: z.string().min(1),
  display_name: z.string().min(1),
  manufacturer_id: z.string().min(1),
  class: z.string().min(1),
  release_update: z.string().nullable(),
  is_garage_storable: z.boolean(),
  variant_of: z.string().nullable(),
  tags: z.array(z.string()),
  image_path: z.string().min(1).nullable(),
  // Base GTA Online purchase price in $. Null = not for sale / mission-only / unsourced.
  price: z.number().int().min(0).nullable().optional(),
  _sources: z.object({
    durtyfree: z.string().url(),
    fandom: z.string().url(),
  }),
});
export const VehiclesFileSchema = z.array(VehicleSchema);

export const SubSlotSchema = z.object({
  label: z.string().min(1),
  capacity: z.number().int().min(0),
  /** Optional: ID of another upgrade that must be installed for this sub-slot to exist (e.g. the mansion Podium upgrade unlocks the podium sub-slot). */
  required_upgrade_id: z.string().nullable().optional(),
});

export const PropertyUpgradeSchema = z.object({
  id: z.string().min(1),
  display_name: z.string().min(1),
  tier: z.number().int().nullable(),
  capacity: z.number().int().min(0),
  required_upgrade_id: z.string().nullable(),
  notes: z.string().nullable(),
  // Upgrade purchase price in $. Null = unsourced.
  price: z.number().int().min(0).nullable().optional(),
  /** Optional sub-slot breakdown. Sum of capacities should equal the upgrade's capacity (or, for an "always-on" upgrade like the mansion's base 20-car slot, the property's base_capacity). */
  sub_slots: z.array(SubSlotSchema).nullable().optional(),
  /** When set, this upgrade is mutually exclusive with other upgrades on the same property sharing the same mutex_group label. Installing one auto-uninstalls the others. E.g. Super Yacht model variants. */
  mutex_group: z.string().nullable().optional(),
});

export const PropertySchema = z.object({
  id: z.string().min(1),
  display_name: z.string().min(1),
  property_type: z.enum(["business", "residence", "garage", "special"]),
  subtype: z.string().min(1),
  subtype_display: z.string().min(1),
  location: z.string().nullable(),
  neighborhood: z.string().nullable(),
  capacity: z.number().int().min(0),
  // Base GTA Online purchase price in $. Null = unsourced.
  price: z.number().int().min(0).nullable().optional(),
  // Self-referencing FK: when set, this row is a unit (e.g. apartment 3 of
  // Eclipse Towers) and the tower's row id lives here. Towers themselves
  // carry parent_building=null and are non-ownable in the UI — clicking
  // them opens a units dialog instead. Optional so existing per-type seed
  // files don't all need updating — build-properties.ts defaults to null.
  parent_building: z.string().nullable().optional(),
  image_path: z.string().min(1).nullable(),
  counts_as_garage: z.boolean(),
  upgrades: z.array(PropertyUpgradeSchema),
  _sources: z.object({
    fandom: z.string().url().nullable(),
    gtabase: z.string().url().nullable(),
  }),
  verify: z.boolean().optional(),
});
export const PropertiesFileSchema = z.array(PropertySchema);

export type Manufacturer = z.infer<typeof ManufacturerSchema>;
export type Tag = z.infer<typeof TagSchema>;
export type Vehicle = z.infer<typeof VehicleSchema>;
export type Property = z.infer<typeof PropertySchema>;
export type PropertyUpgrade = z.infer<typeof PropertyUpgradeSchema>;
