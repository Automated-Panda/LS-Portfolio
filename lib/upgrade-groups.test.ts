import { describe, it, expect } from "vitest";

import { groupUpgrades, mutexGroupLabels } from "./upgrade-groups";

const u = (id: string, mutex_group: string | null, mutex_allow_none = false) => ({
  id,
  mutex_group,
  mutex_allow_none,
});

describe("groupUpgrades", () => {
  it("keeps standalone upgrades as singles in order", () => {
    const out = groupUpgrades([u("a", null), u("b", null)]);
    expect(out.map((e) => e.type)).toEqual(["single", "single"]);
  });

  it("collects members sharing a mutex_group into one group at the first position", () => {
    const out = groupUpgrades([
      u("orion", "Model"),
      u("pisces", "Model"),
      u("aquarius", "Model"),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe("group");
    if (out[0].type !== "group") return;
    expect(out[0].group.label).toBe("Model");
    expect(out[0].group.members.map((m) => m.id)).toEqual([
      "orion",
      "pisces",
      "aquarius",
    ]);
  });

  it("interleaves groups and singles, group anchored to its first member", () => {
    const out = groupUpgrades([
      u("security", null),
      u("orion", "Model"),
      u("renovations", null),
      u("pisces", "Model"),
    ]);
    expect(out.map((e) => (e.type === "group" ? e.group.key : e.upgrade.id))).toEqual(
      ["security", "Model", "renovations"],
    );
    const g = out[1];
    if (g.type !== "group") throw new Error("expected group");
    expect(g.group.members.map((m) => m.id)).toEqual(["orion", "pisces"]);
  });

  it("allowNone is true when any member opts in", () => {
    const out = groupUpgrades([u("a", "G", false), u("b", "G", true)]);
    if (out[0].type !== "group") throw new Error("expected group");
    expect(out[0].group.allowNone).toBe(true);
  });
});

describe("mutexGroupLabels", () => {
  it("lists distinct groups in first-seen order", () => {
    expect(
      mutexGroupLabels([u("a", "Model"), u("b", "Trim"), u("c", "Model"), u("d", null)]),
    ).toEqual(["Model", "Trim"]);
  });
});
