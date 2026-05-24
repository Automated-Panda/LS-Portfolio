-- Piece 1.1: parent_building self-referencing FK for tower → units grouping.
-- High-end apartment towers (Eclipse Towers, Tinsel Towers, etc.) have
-- multiple purchaseable units (apartments + suites). We model them as:
--   • Tower row: parent_building = NULL  (shown in browse grid, non-ownable)
--   • Unit rows: parent_building = tower.id  (revealed via tower dialog, ownable)

alter table public.properties
  add column if not exists parent_building text
    references public.properties(id) on delete cascade;

create index if not exists properties_parent_building_idx
  on public.properties(parent_building);
