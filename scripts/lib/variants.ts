const MANUAL_OVERRIDES: Record<string, string> = {
  // child_internal_name: parent_internal_name
  // add as needed when spot-checks reveal misses
};

export function detectVariantOf(
  internalName: string,
  allInternalNames: Set<string>,
): string | null {
  if (MANUAL_OVERRIDES[internalName]) return MANUAL_OVERRIDES[internalName];
  const match = internalName.match(/^(.+?)(\d+)$/);
  if (!match) return null;
  const base = match[1];
  if (allInternalNames.has(base) && base !== internalName) return base;
  return null;
}
