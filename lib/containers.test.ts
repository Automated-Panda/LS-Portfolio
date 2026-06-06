import { describe, it, expect } from "vitest";
import {
  isContainerVehicle,
  containerBays,
  bayForStoredVehicle,
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
