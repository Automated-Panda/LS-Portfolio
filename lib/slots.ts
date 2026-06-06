// lib/slots.ts
// Pure helpers for numbered garage slots. A "slot" is a physical parking spot
// 1..capacity within one storage area (base storage or a car-storage upgrade /
// garage floor). slot_number is null when a car is in the garage but not yet
// placed in a spot ("unplaced"). See migration 0038 + docs/notes.md.
//
// These functions are deliberately side-effect free so they're unit-testable and
// shared between the server actions (validation) and the client UI (next-free
// hints, swap detection). No DB access here.

export type SlotOccupant = {
  id: string;
  /** null = unplaced (in the garage, no spot chosen). */
  slot_number: number | null;
};

/** The set of slot numbers currently taken in an area. */
export function takenSlots(occupants: SlotOccupant[]): Set<number> {
  const taken = new Set<number>();
  for (const o of occupants) {
    if (o.slot_number != null) taken.add(o.slot_number);
  }
  return taken;
}

/**
 * Lowest free slot in 1..capacity, or null when the area is full of placed cars.
 * Used as the smart default when placing a car via the stepper or a drag.
 */
export function nextFreeSlot(
  occupants: SlotOccupant[],
  capacity: number,
): number | null {
  const taken = takenSlots(occupants);
  for (let i = 1; i <= capacity; i++) {
    if (!taken.has(i)) return i;
  }
  return null;
}

/** Clamp a (possibly typed) number into a valid slot for this area. */
export function clampSlot(n: number, capacity: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(capacity, Math.floor(n)));
}

/** Is `n` a valid slot index for an area of this capacity? */
export function isValidSlot(n: number, capacity: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= capacity;
}

/**
 * The occupant currently in `slot`, excluding `selfId` (so a car re-confirming
 * its own slot doesn't register as a conflict). Returns null when the slot is
 * empty. A non-null result means a stepper/drag onto this slot is a SWAP.
 */
export function occupantAtSlot(
  occupants: SlotOccupant[],
  slot: number,
  selfId?: string,
): SlotOccupant | null {
  return (
    occupants.find((o) => o.slot_number === slot && o.id !== selfId) ?? null
  );
}

/**
 * Auto-arrange: assign sequential slots 1..N to the given ordered cars (caller
 * passes them in the desired order, e.g. created_at). Cars beyond `capacity`
 * are left unplaced (slot null) — the area can't hold more numbered spots than
 * its capacity. Returns the full desired assignment for every input id so the
 * caller can clear-then-set in one pass.
 */
export function planAutoArrange(
  ordered: { id: string }[],
  capacity: number,
): Array<{ id: string; slot: number | null }> {
  return ordered.map((o, i) => ({
    id: o.id,
    slot: i < capacity ? i + 1 : null,
  }));
}
