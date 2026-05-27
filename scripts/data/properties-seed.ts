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
import { SALVAGE_YARDS } from "./salvage-yards-seed";
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
 *                 agency, arcade, auto-shop, salvage-yard,
 *                 vehicle-warehouse, hangar, yacht,
 *                 biker-business-{coke,meth,weed,cash,forgery}
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
  ...SALVAGE_YARDS,
  ...VEHICLE_WAREHOUSES,
  ...CARGO_WAREHOUSES,
  // Aircraft / boats
  ...HANGARS_SEED,
  ...YACHTS_SEED,
  // Nightclub + biker businesses
  ...NIGHTCLUBS_SEED,
  ...COKE_BUSINESSES,
  ...METH_BUSINESSES,
  ...WEED_BUSINESSES,
  ...CASH_BUSINESSES,
  ...FORGERY_BUSINESSES,
];
