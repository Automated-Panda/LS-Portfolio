// lib/upgrade-groups.ts
// Partition an ordered upgrade list into mutually-exclusive ("pick one") groups
// and standalone upgrades. Pure + client-safe so both the admin editor and the
// user-facing upgrade checklist render groups the same way. A group's label is
// just its `mutex_group` string (admin-editable free text); a group is rendered
// at the position of its FIRST member, preserving overall order.

export type GroupableUpgrade = {
  id: string;
  mutex_group: string | null;
  mutex_allow_none?: boolean | null;
};

export type UpgradeGroup<T> = {
  key: string; // the shared mutex_group value (also the display label)
  label: string;
  allowNone: boolean; // show a "None" opt-out choice to the user
  members: T[];
};

export type UpgradeGroupEntry<T> =
  | { type: "single"; upgrade: T }
  | { type: "group"; group: UpgradeGroup<T> };

export function groupUpgrades<T extends GroupableUpgrade>(
  upgrades: T[],
): UpgradeGroupEntry<T>[] {
  const out: UpgradeGroupEntry<T>[] = [];
  const indexByGroup = new Map<string, number>();
  for (const u of upgrades) {
    const g = u.mutex_group?.trim();
    if (!g) {
      out.push({ type: "single", upgrade: u });
      continue;
    }
    const at = indexByGroup.get(g);
    if (at == null) {
      out.push({
        type: "group",
        group: { key: g, label: g, allowNone: !!u.mutex_allow_none, members: [u] },
      });
      indexByGroup.set(g, out.length - 1);
    } else {
      const entry = out[at];
      if (entry.type === "group") {
        entry.group.members.push(u);
        if (u.mutex_allow_none) entry.group.allowNone = true;
      }
    }
  }
  return out;
}

/** Distinct mutex group labels present on an upgrade list, in first-seen order. */
export function mutexGroupLabels(upgrades: GroupableUpgrade[]): string[] {
  const seen: string[] = [];
  for (const u of upgrades) {
    const g = u.mutex_group?.trim();
    if (g && !seen.includes(g)) seen.push(g);
  }
  return seen;
}
