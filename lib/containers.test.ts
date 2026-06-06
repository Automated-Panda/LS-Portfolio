import { describe, it, expect } from "vitest";
import {
  isContainerVehicle,
  containerBays,
  bayForStoredVehicle,
  deriveContainerView,
} from "./containers";

describe("containers", () => {
  it("identifies container vehicles", () => {
    expect(isContainerVehicle("kosatka")).toBe(true);
    expect(isContainerVehicle("banshee")).toBe(false);
  });
  it("lists a container's bays", () => {
    const bays = containerBays("kosatka");
    expect(bays.map((b) => b.label)).toContain("Kraken Avisa");
  });
  it("finds which container bay accepts a stored vehicle", () => {
    const m = bayForStoredVehicle("avisa");
    expect(m?.containerVehicleId).toBe("kosatka");
    expect(m?.bay.label).toBe("Kraken Avisa");
  });
  it("returns null for a vehicle no container stores", () => {
    expect(bayForStoredVehicle("banshee")).toBeNull();
  });
});

const rawUpgrades = [
  {
    id: "kosatka-sonar-station",
    display_name: "Sonar Station",
    capacity: 0,
    sub_slots: null,
    required_upgrade_id: null,
    mutex_group: null,
    included_on_purchase: false,
    price: 1200000,
    sort_order: 2,
  },
  {
    id: "kosatka-moon-pool",
    display_name: "Moon Pool",
    capacity: 2,
    sub_slots: [
      { label: "Sparrow", capacity: 1, vehicle_id: "seasparrow2", vehicle_ids: null },
      { label: "Kraken Avisa", capacity: 1, vehicle_id: "avisa", vehicle_ids: null },
    ],
    required_upgrade_id: null,
    mutex_group: null,
    included_on_purchase: true,
    price: null,
    sort_order: 1,
  },
];

describe("deriveContainerView", () => {
  it("sorts upgrades by sort_order", () => {
    const { upgrades } = deriveContainerView(rawUpgrades, new Set());
    expect(upgrades.map((u) => u.id)).toEqual([
      "kosatka-moon-pool",
      "kosatka-sonar-station",
    ]);
  });

  it("treats included_on_purchase as installed, others by the installed set", () => {
    const { upgrades } = deriveContainerView(rawUpgrades, new Set());
    const byId = Object.fromEntries(upgrades.map((u) => [u.id, u.is_installed]));
    expect(byId["kosatka-moon-pool"]).toBe(true);
    expect(byId["kosatka-sonar-station"]).toBe(false);
  });

  it("marks a purchased upgrade installed when in the set", () => {
    const { upgrades } = deriveContainerView(
      rawUpgrades,
      new Set(["kosatka-sonar-station"]),
    );
    expect(
      upgrades.find((u) => u.id === "kosatka-sonar-station")?.is_installed,
    ).toBe(true);
  });

  it("exposes bays only from installed upgrades with sub_slots", () => {
    const { bays } = deriveContainerView(rawUpgrades, new Set());
    expect(bays.map((b) => b.label)).toEqual(["Sparrow", "Kraken Avisa"]);
    expect(bays[0]).toMatchObject({
      upgrade_id: "kosatka-moon-pool",
      vehicle_id: "seasparrow2",
    });
  });

  it("hides bays whose gating upgrade is not installed", () => {
    const gated = [
      {
        id: "terbyte-specialized-workshop",
        display_name: "Specialized Workshop",
        capacity: 1,
        sub_slots: [
          { label: "Oppressor Mk II", capacity: 1, vehicle_id: "oppressor2", vehicle_ids: null },
        ],
        required_upgrade_id: null,
        mutex_group: null,
        included_on_purchase: false,
        price: 495000,
        sort_order: 1,
      },
    ];
    expect(deriveContainerView(gated, new Set()).bays).toHaveLength(0);
    expect(
      deriveContainerView(gated, new Set(["terbyte-specialized-workshop"])).bays,
    ).toHaveLength(1);
  });
});
