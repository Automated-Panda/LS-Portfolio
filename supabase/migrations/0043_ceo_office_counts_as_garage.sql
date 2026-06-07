-- 0043_ceo_office_counts_as_garage.sql
-- CEO Executive Offices store cars in their chained Office Garage upgrades
-- (3 levels × 20). They were seeded counts_as_garage = false, which both
-- excluded them from the car-storage picker AND blocked the numbered-slot grid.
-- Flip them to true so cars can be parked and each level renders as a garage.
-- The building's own base capacity stays 0; storage still lives on the upgrades.
-- Idempotent.

update public.properties
set counts_as_garage = true
where subtype = 'ceo-office'
  and counts_as_garage is distinct from true;
