"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  setAllUpgradesInstalled,
  toggleUpgradeInstalled,
} from "@/app/(app)/my-properties/actions";
import type { OwnedPropertyDetail } from "@/lib/queries/my-properties";

/**
 * Optimistic install/uninstall state for a property's upgrades. Encapsulates
 * the mutex-sibling handling and the install-all/uninstall-all bulk action so
 * the property detail page (and any other surface) can drive the upgrade
 * checklist without re-implementing the round-trip + rollback logic.
 */
export function usePropertyUpgrades(property: OwnedPropertyDetail) {
  const [isPending, startTransition] = useTransition();

  // Optimistic overrides for upgrade is_installed. Map<upgradeId, installed>.
  // When set, takes precedence over the server-derived `u.is_installed`.
  const [optimisticInstalled, setOptimisticInstalled] = useState<
    Map<string, boolean>
  >(new Map());

  const isInstalled = (id: string, fallback: boolean) =>
    optimisticInstalled.has(id)
      ? (optimisticInstalled.get(id) as boolean)
      : fallback;

  const setOptimistic = (id: string, value: boolean | undefined) => {
    setOptimisticInstalled((prev) => {
      const next = new Map(prev);
      if (value === undefined) next.delete(id);
      else next.set(id, value);
      return next;
    });
  };

  const handleToggleUpgrade = (
    upgradeId: string,
    currentlyInstalled: boolean,
  ) => {
    // Optimistic flip — instant visual feedback.
    setOptimistic(upgradeId, !currentlyInstalled);

    // Mutex-group sibling handling — installing an upgrade in a mutex group
    // optimistically uninstalls every sibling (server does the same atomically).
    const target = property.upgrades.find((u) => u.id === upgradeId);
    if (!currentlyInstalled && target?.mutex_group) {
      for (const sib of property.upgrades) {
        if (sib.id !== upgradeId && sib.mutex_group === target.mutex_group) {
          setOptimistic(sib.id, false);
        }
      }
    }

    startTransition(async () => {
      const r = await toggleUpgradeInstalled(property.id, upgradeId);
      // Either way, drop the overrides so revalidated server data takes over.
      // On error also surface the message.
      setOptimistic(upgradeId, undefined);
      if (target?.mutex_group) {
        for (const sib of property.upgrades) {
          if (sib.id !== upgradeId && sib.mutex_group === target.mutex_group) {
            setOptimistic(sib.id, undefined);
          }
        }
      }
      if ("error" in r) toast.error(r.error);
    });
  };

  const handleSetAllUpgrades = (installed: boolean) => {
    // Optimistic-set every USER-TOGGLEABLE upgrade. Skip included_on_purchase
    // ones — they're not user choices and "Uninstall all" must not orphan
    // their stored cars.
    setOptimisticInstalled(() => {
      const next = new Map<string, boolean>();
      for (const u of property.upgrades) {
        if (u.included_on_purchase) continue;
        next.set(u.id, installed);
      }
      return next;
    });
    startTransition(async () => {
      const r = await setAllUpgradesInstalled(property.id, installed);
      setOptimisticInstalled(new Map());
      if ("error" in r) {
        toast.error(r.error);
      } else {
        toast.success(
          installed
            ? `Installed all upgrades (${r.changed})`
            : `Uninstalled all upgrades (${r.changed})`,
        );
      }
    });
  };

  return {
    isPending,
    isInstalled,
    handleToggleUpgrade,
    handleSetAllUpgrades,
  };
}
