import type { Property } from "../schema";

/**
 * GTA Online Arcades — 6 purchasable locations.
 * Added with The Diamond Casino Heist DLC. Each arcade serves as the
 * planning hub for the Casino Heist and includes a basement garage
 * storing up to 10 vehicles for heist prep.
 *
 * Sources:
 *   https://gta.fandom.com/wiki/Arcades
 *   https://www.gtabase.com/grand-theft-auto-v/properties-gta-online/pixel-pete-s-arcade
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
    id: "arcade-pixel-petes",
    display_name: "Pixel Pete's",
    neighborhood: "Paleto Bay",
    address: "Paleto Bay, Blaine County",
  },
  {
    id: "arcade-wonderama",
    display_name: "Wonderama",
    neighborhood: "Grapeseed",
    address: "Grapeseed, Blaine County",
  },
  {
    id: "arcade-the-warehouse",
    display_name: "The Warehouse",
    neighborhood: "Davis",
    address: "Davis, Los Santos",
  },
  {
    id: "arcade-videogeddon",
    display_name: "Videogeddon",
    neighborhood: "La Mesa",
    address: "La Mesa, Los Santos",
  },
  {
    id: "arcade-insert-coin",
    display_name: "Insert Coin",
    neighborhood: "Rockford Hills",
    address: "Rockford Hills, Los Santos",
  },
  {
    id: "arcade-eight-bit",
    display_name: "Eight-Bit",
    neighborhood: "Vinewood",
    address: "Vinewood Boulevard, Los Santos",
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
