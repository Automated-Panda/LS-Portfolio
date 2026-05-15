import type { Property } from "../schema";

/**
 * GTA Online Arcades — 6 per-location instances.
 * Arcade properties serve as the planning hub for the Casino Heist.
 * Each includes a basement garage storing up to 10 vehicles for heist prep.
 *
 * Sources:
 *   https://gta.fandom.com/wiki/Arcades
 */

type LocationSeed = {
  id: string;
  display_name: string;
  neighborhood: string;
  address: string;
  verify?: boolean;
};

const LOCATIONS: LocationSeed[] = [
  {
    id: "arcade-paleto-bay",
    display_name: "Paleto Bay Arcade (Eight-Bit)",
    neighborhood: "Paleto Bay",
    address: "Paleto Bay, Blaine County",
    verify: true,
  },
  {
    id: "arcade-grapeseed",
    display_name: "Pixel Pete's (Grapeseed)",
    neighborhood: "Grapeseed",
    address: "Grapeseed, Blaine County",
    verify: true,
  },
  {
    id: "arcade-davis",
    display_name: "Wonderama (Davis)",
    neighborhood: "Davis",
    address: "Davis, Los Santos",
    verify: true,
  },
  {
    id: "arcade-la-mesa",
    display_name: "Insert Coin (La Mesa)",
    neighborhood: "La Mesa",
    address: "La Mesa, Los Santos",
    verify: true,
  },
  {
    id: "arcade-vinewood",
    display_name: "Videogeddon (Vinewood)",
    neighborhood: "Vinewood",
    address: "Vinewood Boulevard, Los Santos",
    verify: true,
  },
  {
    id: "arcade-rockford-hills",
    display_name: "Videogeddon (Rockford Hills)",
    neighborhood: "Rockford Hills",
    address: "Rockford Hills, Los Santos",
    verify: true,
  },
];

function buildArcade(loc: LocationSeed): Omit<Property, "image_path"> {
  return {
    id: loc.id,
    display_name: loc.display_name,
    property_type: "business",
    subtype: "arcade",
    subtype_display: "Arcade",
    location: loc.address,
    neighborhood: loc.neighborhood,
    capacity: 0,
    counts_as_garage: true,
    upgrades: [
      {
        id: `${loc.id}-garage`,
        display_name: "Arcade Garage",
        tier: null,
        capacity: 10,
        required_upgrade_id: null,
        notes: "Underground garage for Casino Heist prep vehicles",
      },
    ],
    _sources: {
      fandom: "https://gta.fandom.com/wiki/Arcades",
      gtabase: null,
    },
    ...(loc.verify ? { verify: true } : {}),
  };
}

export const ARCADES: Omit<Property, "image_path">[] =
  LOCATIONS.map(buildArcade);
