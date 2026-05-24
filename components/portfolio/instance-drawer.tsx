"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  removeVehicleInstance,
  updateVehicleInstance,
  assignVehicleStorage,
} from "@/app/(app)/my-vehicles/actions";
import type { OwnedVehicleInstance } from "@/lib/queries/my-vehicles";
import type { OwnedPropertyDetail } from "@/lib/queries/my-properties";

import { CustomTagsInput } from "./custom-tags-input";

type Props = {
  instance: OwnedVehicleInstance;
  ownedProperties: OwnedPropertyDetail[];
  /** Union of all custom_tags across user's fleet — feeds the tag autocomplete. */
  tagSuggestions?: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function InstanceDrawer({
  instance,
  ownedProperties,
  tagSuggestions,
  open,
  onOpenChange,
}: Props) {
  const [nickname, setNickname] = useState(instance.nickname ?? "");
  const [notes, setNotes] = useState(instance.notes ?? "");
  const [tags, setTags] = useState(instance.custom_tags);
  const [propertyId, setPropertyId] = useState(
    instance.storage?.owned_property_id ?? "",
  );
  const [upgradeId, setUpgradeId] = useState(
    instance.storage?.assigned_upgrade_id ?? "",
  );
  const [isPending, startTransition] = useTransition();

  const selectedProperty = ownedProperties.find((p) => p.id === propertyId);
  const installedUpgrades =
    selectedProperty?.upgrades.filter(
      (u) => u.is_installed && u.capacity > 0,
    ) ?? [];

  const handleSave = () => {
    startTransition(async () => {
      const meta = await updateVehicleInstance({
        ownedVehicleId: instance.id,
        nickname: nickname || null,
        notes: notes || null,
        customTags: tags,
      });
      if ("error" in meta) {
        toast.error(meta.error);
        return;
      }

      const storage = await assignVehicleStorage({
        ownedVehicleId: instance.id,
        ownedPropertyId: propertyId || null,
        assignedUpgradeId: upgradeId || null,
      });
      if ("error" in storage) {
        toast.error(storage.error);
        return;
      }
      if ("capacityExceeded" in storage) {
        toast.error(
          `Full: ${storage.capacityExceeded.current} / ${storage.capacityExceeded.capacity}`,
        );
        return;
      }
      toast.success("Saved");
      onOpenChange(false);
    });
  };

  const handleRemove = () => {
    if (!confirm("Remove this vehicle instance from your portfolio?")) return;
    startTransition(async () => {
      const result = await removeVehicleInstance(instance.id);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Removed");
      onOpenChange(false);
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{nickname || instance.display_name}</SheetTitle>
          <SheetDescription>
            {instance.manufacturer_display} · {instance.class}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 py-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="nickname">Nickname</Label>
            <Input
              id="nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="e.g. Pearl Black Banshee"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Storage location</Label>
            <select
              className="rounded-md border bg-background px-3 py-2 text-sm"
              value={propertyId}
              onChange={(e) => {
                setPropertyId(e.target.value);
                setUpgradeId("");
              }}
            >
              <option value="">— Unassigned —</option>
              {ownedProperties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.display_name} ({p.subtype_display})
                </option>
              ))}
            </select>
            {installedUpgrades.length > 0 && (
              <select
                className="rounded-md border bg-background px-3 py-2 text-sm"
                value={upgradeId}
                onChange={(e) => setUpgradeId(e.target.value)}
              >
                <option value="">Base storage</option>
                {installedUpgrades.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.display_name} ({u.capacity})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label>Custom tags</Label>
            <CustomTagsInput
              value={tags}
              onChange={setTags}
              suggestions={tagSuggestions}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="notes">Notes</Label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-24 rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>

        <SheetFooter className="flex-col gap-2 sm:flex-col">
          <Button onClick={handleSave} disabled={isPending} className="w-full">
            Save changes
          </Button>
          <Button
            variant="outline"
            onClick={handleRemove}
            disabled={isPending}
            className="w-full border-red-500/50 text-red-300 hover:bg-red-500/10"
          >
            Remove this instance
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
