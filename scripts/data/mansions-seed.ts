import type { Property } from "../schema";

/**
 * GTA Online Mansions — "A Safehouse in the Hills" update (Dec 2025).
 *
 * Three standalone luxury residences in/around Vinewood Hills. Each holds
 * 20 cars total: 17 regular garage slots + 2 driveway display slots + 1
 * podium display slot. The podium upgrade unlocks the visual podium slot
 * style — it doesn't add to the 20-car cap.
 *
 * Other upgrades (Armory, Vehicle Workshop, Arcade Room) are cosmetic and
 * don't add storage capacity either.
 *
 * Security Team is a $1.75M one-time upgrade that covers all three mansions
 * once purchased. It's modeled on The Tongva Estate only — toggling it there
 * represents owning the service across the set. (Awkward but keeps the data
 * model simple; revisit if a "global upgrades" pattern becomes worth it.)
 *
 * The free Volatus helicopter on the rooftop helipad is not modeled as a
 * storage slot — it's a gift, not capacity.
 *
 * Ownership: new `mansion` ownership_group with cap 3 (migration 0010).
 * All three can be owned simultaneously.
 *
 * Sources:
 *   - https://www.gtaboom.com/gta-online-a-safehouse-in-the-hills-dlc-guide-be82
 *   - https://gta.fandom.com/wiki/GTA_Online:_A_Safehouse_in_the_Hills
 */

const COMMON_UPGRADES = (mansionId: string) => [
  {
    id: `${mansionId}-podium`,
    display_name: "Car Podium",
    tier: null,
    capacity: 0,
    required_upgrade_id: null,
    notes: "Unlocks the rotating-podium display style for 1 of the 20 slots. Doesn't add capacity.",
  },
  {
    id: `${mansionId}-armory`,
    display_name: "Armory",
    tier: null,
    capacity: 0,
    required_upgrade_id: null,
    notes: null,
  },
  {
    id: `${mansionId}-workshop`,
    display_name: "Vehicle Workshop",
    tier: null,
    capacity: 0,
    required_upgrade_id: null,
    notes: null,
  },
  {
    id: `${mansionId}-arcade`,
    display_name: "Arcade Room",
    tier: null,
    capacity: 0,
    required_upgrade_id: null,
    notes: null,
  },
];

export const MANSIONS_SEED: Omit<Property, "image_path">[] = [
  {
    id: "mansion-tongva",
    display_name: "The Tongva Estate",
    property_type: "residence",
    subtype: "mansion",
    subtype_display: "Mansion",
    location: "Tongva Hills, overlooking the vineyards and Pacific Ocean",
    neighborhood: "Tongva Hills",
    capacity: 20, // 17 garage + 2 driveway + 1 podium; podium upgrade is cosmetic-only
    counts_as_garage: true,
    upgrades: [
      ...COMMON_UPGRADES("mansion-tongva"),
      {
        id: "mansion-tongva-security",
        display_name: "Security Team",
        tier: null,
        capacity: 0,
        required_upgrade_id: null,
        notes:
          "One-time purchase ($1.75M) that covers all three mansions. Toggle on a single mansion to represent owning the service set-wide.",
      },
    ],
    _sources: {
      fandom: "https://gta.fandom.com/wiki/The_Tongva_Estate",
      gtabase: "https://www.gtabase.com/properties/gta-online/the-tongva-estate-devin-weston-mansion",
    },
  },
  {
    id: "mansion-vinewood",
    display_name: "The Vinewood Residence",
    property_type: "residence",
    subtype: "mansion",
    subtype_display: "Mansion",
    location: "Across from the Vinewood sign, overlooking the city",
    neighborhood: "Vinewood Hills",
    capacity: 20,
    counts_as_garage: true,
    upgrades: COMMON_UPGRADES("mansion-vinewood"),
    _sources: {
      fandom: "https://gta.fandom.com/wiki/The_Vinewood_Residence",
      gtabase: "https://www.gtabase.com/properties/gta-online/the-vinewood-residence-mansion",
    },
  },
  {
    id: "mansion-richman",
    display_name: "Richman Villa",
    property_type: "residence",
    subtype: "mansion",
    subtype_display: "Mansion",
    location: "Richman, the wealthiest neighborhood in Los Santos",
    neighborhood: "Richman",
    capacity: 20,
    counts_as_garage: true,
    upgrades: COMMON_UPGRADES("mansion-richman"),
    _sources: {
      fandom: "https://gta.fandom.com/wiki/Richman_Villa",
      gtabase: "https://www.gtabase.com/properties/gta-online/richman-villa-mansion",
    },
  },
];
