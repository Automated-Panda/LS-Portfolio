-- 0048_owned_property_unique_per_character.sql
-- Ownership uniqueness is now per CHARACTER, not per account: two characters on
-- the same GTVault login can each own the same property (e.g. both have a
-- Galaxy Super Yacht). Replace the old unique(user_id, property_id) with a
-- per-character unique. Safe — every row has a character_id (migration 0047),
-- and today each account has exactly one character, so no duplicates exist.
-- Idempotent.

alter table public.user_owned_properties
  drop constraint if exists user_owned_properties_user_id_property_id_key;

create unique index if not exists user_owned_properties_character_property_key
  on public.user_owned_properties (character_id, property_id);
