"use client";

import { Plus, X } from "lucide-react";
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

import { formatMoneyCompact, formatMoneyFull } from "@/lib/format";

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

  // Auto-expand fields that already have content on open. Empty fields show
  // as `+ Field name` pill buttons; clicking expands the input inline.
  const [showNickname, setShowNickname] = useState(
    (instance.nickname ?? "") !== "",
  );
  const [showTags, setShowTags] = useState(instance.custom_tags.length > 0);
  const [showNotes, setShowNotes] = useState((instance.notes ?? "") !== "");

  const collapsedButtons: Array<{
    key: "nickname" | "tags" | "notes";
    label: string;
    expanded: boolean;
    expand: () => void;
  }> = [
    {
      key: "nickname",
      label: "Custom Name",
      expanded: showNickname,
      expand: () => setShowNickname(true),
    },
    {
      key: "tags",
      label: "Highlights",
      expanded: showTags,
      expand: () => setShowTags(true),
    },
    {
      key: "notes",
      label: "Notes",
      expanded: showNotes,
      expand: () => setShowNotes(true),
    },
  ];
  const anyCollapsed = collapsedButtons.some((b) => !b.expanded);

  // Only show properties that can actually store vehicles — hides hangars,
  // yachts, businesses without garages, etc. from the storage picker.
  const storableProperties = ownedProperties.filter((p) => p.counts_as_garage);
  const selectedProperty = storableProperties.find((p) => p.id === propertyId);
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
    if (!confirm(`Remove this ${instance.display_name} from your portfolio?`)) return;
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
            {instance.price !== null && (
              <>
                {" · "}
                <span
                  className="text-emerald-400 tabular-nums"
                  title={formatMoneyFull(instance.price)}
                >
                  {formatMoneyCompact(instance.price)}
                </span>
              </>
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 py-4">
          {/* Storage stays always-visible — it's the functional core. */}
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
              {storableProperties.map((p) => (
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

          {/* Collapsed-field pill row — only shows for fields not yet expanded. */}
          {anyCollapsed && (
            <div className="flex flex-wrap gap-2">
              {collapsedButtons
                .filter((b) => !b.expanded)
                .map((b) => (
                  <button
                    key={b.key}
                    type="button"
                    onClick={b.expand}
                    className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-foreground/30 px-3 py-1 text-xs text-muted-foreground hover:border-foreground/60 hover:text-foreground transition-colors"
                  >
                    <Plus className="h-3 w-3" /> {b.label}
                  </button>
                ))}
            </div>
          )}

          {showNickname && (
            <ExpandableField
              label="Custom Name"
              onCollapse={() => {
                setNickname("");
                setShowNickname(false);
              }}
            >
              <Input
                id="nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="e.g. Pearl Black Banshee"
                autoFocus={!instance.nickname}
              />
            </ExpandableField>
          )}

          {showTags && (
            <ExpandableField
              label="Highlight features"
              onCollapse={() => {
                setTags([]);
                setShowTags(false);
              }}
            >
              <CustomTagsInput
                value={tags}
                onChange={setTags}
                suggestions={tagSuggestions}
              />
            </ExpandableField>
          )}

          {showNotes && (
            <ExpandableField
              label="Notes"
              onCollapse={() => {
                setNotes("");
                setShowNotes(false);
              }}
            >
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-24 rounded-md border bg-background px-3 py-2 text-sm w-full"
                autoFocus={!instance.notes}
              />
            </ExpandableField>
          )}
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
            Remove vehicle
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function ExpandableField({
  label,
  children,
  onCollapse,
}: {
  label: string;
  children: React.ReactNode;
  onCollapse: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <button
          type="button"
          onClick={onCollapse}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
          aria-label={`Clear ${label}`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {children}
    </div>
  );
}
