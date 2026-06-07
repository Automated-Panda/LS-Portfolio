// lib/characters-shared.ts
// Client-safe types + constants for the multi-character switcher/manager. Kept
// separate from lib/queries/characters.ts (which imports next/headers) so client
// components can use these without pulling server-only code into their bundle.

/** Max characters per GTA-account profile (GTA's limit). */
export const MAX_CHARACTERS_PER_PROFILE = 2;

export type SwitcherCharacter = {
  id: string;
  name: string;
  vehicleCount: number;
  propertyCount: number;
};
export type SwitcherProfile = {
  id: string;
  name: string;
  gtaPlus: boolean;
  characters: SwitcherCharacter[];
};
export type CharacterSwitcherData = {
  profiles: SwitcherProfile[];
  activeCharacterId: string | null;
  isOwner: boolean;
  /** Can the user add another Profile? (owner = unlimited, else 1 free + purchased slots) */
  canAddProfile: boolean;
};
