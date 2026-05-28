import type { Property } from "../schema";

import { NIGHTCLUBS_SEED } from "./nightclubs-seed";
import {
  HIGH_END_APARTMENTS,
  MID_END_APARTMENTS,
  LOW_END_APARTMENTS,
} from "./apartments-seed";
import {
  STANDALONE_GARAGES,
  ECLIPSE_BLVD_GARAGES,
  VINEWOOD_CAR_CLUB,
} from "./garages-seed";
import { CASINO_PENTHOUSE_SEED } from "./casino-penthouse-seed";
import { MANSIONS_SEED } from "./mansions-seed";
import { CEO_OFFICES } from "./offices-seed";
import { MC_CLUBHOUSES } from "./clubhouses-seed";
import { BUNKERS } from "./bunkers-seed";
import { FACILITIES } from "./facilities-seed";
import { AGENCIES } from "./agencies-seed";
import { ARCADES } from "./arcades-seed";
import { AUTO_SHOPS } from "./auto-shops-seed";
import { ARENA_WORKSHOP_SEED } from "./arena-workshop-seed";
import { SALVAGE_YARDS } from "./salvage-yards-seed";
import { BAIL_OFFICES_SEED } from "./bail-offices-seed";
import { VEHICLE_WAREHOUSES } from "./vehicle-warehouses-seed";
import { CARGO_WAREHOUSES } from "./cargo-warehouses-seed";
import { HANGARS_SEED } from "./hangars-seed";
import { YACHTS_SEED } from "./yachts-seed";
import {
  COKE_BUSINESSES,
  METH_BUSINESSES,
  WEED_BUSINESSES,
  CASH_BUSINESSES,
  FORGERY_BUSINESSES,
} from "./biker-businesses-seed";
import {
  MCKENZIE_HANGAR_SEED,
  HIGGINS_HELITOURS_SEED,
} from "./aviation-properties-seed";
import {
  GARMENT_FACTORY_SEED,
  SMOKE_ON_THE_WATER_SEED,
  HANDS_ON_CAR_WASH_SEED,
} from "./sp-businesses-seed";

/**
 * Phase 4b granular property seed — full fanout.
 *
 * Each row is a single in-game property instance, not a type-level archetype.
 * The vast majority of rows currently carry `verify: true` flags because
 * Fandom-page verification was not possible during the seed-authoring pass
 * (Fandom CDN returned 403 to WebFetch). Structure is complete; addresses
 * and instance names need a future verification pass.
 *
 * Coverage (subtypes):
 *   Residential — high-end-apartment, mid-end-apartment, low-end-apartment,
 *                 casino-penthouse, mansion
 *   Garage      — stand-alone-garage, eclipse-blvd-garages
 *   Business    — nightclub, ceo-office, mc-clubhouse, bunker, facility,
 *                 agency, arcade, auto-shop, salvage-yard, bail-office,
 *                 vehicle-warehouse, hangar, yacht,
 *                 biker-business-{coke,meth,weed,cash,forgery},
 *                 mckenzie-hangar (SP-only), higgins-helitours (SP-only),
 *                 garment-factory, smoke-on-the-water, hands-on-car-wash
 */
export const PROPERTIES_SEED: Omit<Property, "image_path">[] = [
  // Residential
  ...HIGH_END_APARTMENTS,
  ...MID_END_APARTMENTS,
  ...LOW_END_APARTMENTS,
  ...CASINO_PENTHOUSE_SEED,
  ...MANSIONS_SEED,
  // Garages
  ...STANDALONE_GARAGES,
  ...ECLIPSE_BLVD_GARAGES,
  ...VINEWOOD_CAR_CLUB,
  // Workplaces
  ...CEO_OFFICES,
  ...MC_CLUBHOUSES,
  ...BUNKERS,
  ...FACILITIES,
  ...AGENCIES,
  ...ARCADES,
  ...AUTO_SHOPS,
  ...ARENA_WORKSHOP_SEED,
  ...SALVAGE_YARDS,
  ...BAIL_OFFICES_SEED,
  ...VEHICLE_WAREHOUSES,
  ...CARGO_WAREHOUSES,
  // Aircraft / boats
  ...HANGARS_SEED,
  ...YACHTS_SEED,
  // SP-only aviation businesses
  ...MCKENZIE_HANGAR_SEED,
  ...HIGGINS_HELITOURS_SEED,
  // SP / narrative-tied businesses (Garment Factory, Smoke on the Water, Hands On Car Wash)
  ...GARMENT_FACTORY_SEED,
  ...SMOKE_ON_THE_WATER_SEED,
  ...HANDS_ON_CAR_WASH_SEED,
  // Nightclub + biker businesses
  ...NIGHTCLUBS_SEED,
  ...COKE_BUSINESSES,
  ...METH_BUSINESSES,
  ...WEED_BUSINESSES,
  ...CASH_BUSINESSES,
  ...FORGERY_BUSINESSES,
];
