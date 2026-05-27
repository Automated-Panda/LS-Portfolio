"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  removeAllVehiclesByCategory,
  removeAllPropertiesByGroup,
  resetAllOwnership,
} from "./danger-zone-actions";

type VehicleCategory = "land" | "air" | "sea";

const VEHICLE_BUTTONS: Array<{ label: string; category: VehicleCategory }> = [
  { label: "Remove all cars + bikes", category: "land" },
  { label: "Remove all aircraft", category: "air" },
  { label: "Remove all boats", category: "sea" },
];

const PROPERTY_BUTTONS: Array<{ label: string; group: string }> = [
  { label: "Remove all residences", group: "residential" },
  { label: "Remove all mansions", group: "mansion" },
  { label: "Remove all garages", group: "garage" },
  { label: "Remove all businesses", group: "business" },
];

export function DangerZone() {
  const [isPending, startTransition] = useTransition();
  const [resetArmed, setResetArmed] = useState(false);

  const runRemoveVehicles = (category: VehicleCategory, label: string) => {
    if (!confirm(`${label}? This will remove every matching vehicle from your portfolio.`)) return;
    startTransition(async () => {
      const r = await removeAllVehiclesByCategory(category);
      if ("error" in r) toast.error(r.error);
      else if (r.removed === 0) toast.info("Nothing to remove.");
      else toast.success(`Removed ${r.removed} vehicle${r.removed === 1 ? "" : "s"}.`);
    });
  };

  const runRemoveProperties = (group: string, label: string) => {
    if (!confirm(`${label}? Vehicles stored at those properties become unassigned (not deleted).`)) return;
    startTransition(async () => {
      const r = await removeAllPropertiesByGroup(group);
      if ("error" in r) toast.error(r.error);
      else if (r.removed === 0) toast.info("Nothing to remove.");
      else toast.success(`Removed ${r.removed} ${r.removed === 1 ? "property" : "properties"}.`);
    });
  };

  const runReset = () => {
    if (!resetArmed) {
      setResetArmed(true);
      toast.warning("Click 'Reset everything' again within 5 seconds to confirm.");
      setTimeout(() => setResetArmed(false), 5000);
      return;
    }
    setResetArmed(false);
    startTransition(async () => {
      const r = await resetAllOwnership();
      if ("error" in r) toast.error(r.error);
      else toast.success(`Wiped ${r.removed} item${r.removed === 1 ? "" : "s"} from your portfolio.`);
    });
  };

  return (
    <Card className="border-red-500/30 bg-red-500/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-300">
          <AlertTriangle className="h-4 w-4" />
          Danger zone
        </CardTitle>
        <CardDescription>
          Bulk removal actions. These can&apos;t be undone.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Vehicles
          </p>
          <div className="flex flex-wrap gap-2">
            {VEHICLE_BUTTONS.map(({ label, category }) => (
              <Button
                key={category}
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={() => runRemoveVehicles(category, label)}
                className="border-red-500/40 text-red-300 hover:bg-red-500/10"
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Properties
          </p>
          <div className="flex flex-wrap gap-2">
            {PROPERTY_BUTTONS.map(({ label, group }) => (
              <Button
                key={group}
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={() => runRemoveProperties(group, label)}
                className="border-red-500/40 text-red-300 hover:bg-red-500/10"
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-2 border-t border-red-500/20">
          <p className="text-xs uppercase tracking-wider text-red-300">
            Nuclear
          </p>
          <Button
            variant={resetArmed ? "destructive" : "outline"}
            size="sm"
            disabled={isPending}
            onClick={runReset}
            className={
              resetArmed
                ? ""
                : "border-red-500/60 text-red-300 hover:bg-red-500/10"
            }
          >
            {resetArmed
              ? "⚠ Click again to confirm — wipes EVERYTHING"
              : "Reset entire portfolio"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
