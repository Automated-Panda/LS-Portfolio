"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { PropertiesBrowser } from "@/app/(app)/properties/properties-browser";
import { togglePropertyOwnership } from "@/app/(app)/properties/actions";
import type { PropertyFilterOptions, PropertySummary } from "@/lib/properties";
import type { PropertyScope } from "@/lib/queries/properties";
import type { OwnedPropertyDetail } from "@/lib/queries/my-properties";

import type { OwnedVehicleInstance } from "@/lib/queries/my-vehicles";

import { PropertyHubList } from "./property-hub-list";

type Step = "picker" | "hub";

type Props = {
  ownedProperties: OwnedPropertyDetail[];
  ownedInstances: OwnedVehicleInstance[];
  tagLookup: Record<string, string>;
  // Combined catalogue (both scopes) for the picker step
  pickerData: {
    properties: PropertySummary[];
    filters: PropertyFilterOptions;
    ownedPropertyIds: string[];
  };
};

export function OnboardingWizard({
  ownedProperties,
  ownedInstances,
  tagLookup,
  pickerData,
}: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(
    ownedProperties.length > 0 ? "hub" : "picker",
  );
  const [pickerSelection, setPickerSelection] = useState<string[]>([]);
  const [isAdvancing, setIsAdvancing] = useState(false);

  const handleAdvance = async () => {
    setIsAdvancing(true);
    for (const propertyId of pickerSelection) {
      // Fire-and-acknowledge — needsTradeIn won't happen during onboarding
      // (user is fresh, can't be at any group limit).
      await togglePropertyOwnership(propertyId);
    }
    router.refresh();
    setStep("hub");
    setIsAdvancing(false);
  };

  if (step === "picker") {
    // We pass scope="properties" to the browser even though pickerData is the
    // combined catalogue — the scope only affects copy/labels, and the wizard's
    // own H1 takes over the visible heading anyway.
    const scope: PropertyScope = "properties";
    return (
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold">Set up your portfolio</h1>
          <p className="text-sm text-muted-foreground">
            Pick the properties you own. You can finish in any order on the next screen.
          </p>
        </div>
        <PropertiesBrowser
          scope={scope}
          properties={pickerData.properties}
          ownedPropertyIds={pickerData.ownedPropertyIds}
          filters={pickerData.filters}
          selectionMode="multi"
          selectedIds={pickerSelection}
          onToggleSelection={(id) =>
            setPickerSelection((prev) =>
              prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
            )
          }
        />
        <div className="sticky bottom-0 flex justify-between border-t bg-background p-3">
          <Button variant="outline" onClick={() => router.push("/dashboard")}>
            Skip for now
          </Button>
          <Button
            onClick={handleAdvance}
            disabled={pickerSelection.length === 0 || isAdvancing}
          >
            Continue with {pickerSelection.length} selected →
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">Your portfolio</h1>
        <p className="text-sm text-muted-foreground">
          Click each property to mark installed upgrades and add cars. Finish whenever.
        </p>
      </div>
      <PropertyHubList
        properties={ownedProperties}
        instances={ownedInstances}
        tagLookup={tagLookup}
      />
      <div className="flex justify-end gap-2 border-t pt-4">
        <Button variant="outline" onClick={() => router.push("/dashboard")}>
          Finish later
        </Button>
        <Button onClick={() => router.push("/my-vehicles")}>Done</Button>
      </div>
    </div>
  );
}
