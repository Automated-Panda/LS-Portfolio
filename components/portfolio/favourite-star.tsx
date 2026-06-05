"use client";

import { Star } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { setFavourite } from "@/app/(app)/vehicles/actions";
import { cn } from "@/lib/utils";

type Props = {
  instanceId: string;
  initial: boolean;
  /** px size of the star icon. Default 16. */
  size?: number;
  /** Notifies the parent after a successful toggle (for optimistic list sync). */
  onChange?: (next: boolean) => void;
  className?: string;
};

/**
 * ⭐ toggle for an owned-vehicle instance. Optimistic flip with rollback on
 * error. Drops into the vehicle cards, the instance popover, and InstanceDrawer.
 */
export function FavouriteStar({
  instanceId,
  initial,
  size = 16,
  onChange,
  className,
}: Props) {
  const [fav, setFav] = useState(initial);
  const [isPending, startTransition] = useTransition();

  const toggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const next = !fav;
    setFav(next); // optimistic
    onChange?.(next);
    startTransition(async () => {
      const res = await setFavourite(instanceId, next);
      if ("error" in res) {
        setFav(!next); // rollback
        onChange?.(!next);
        toast.error(res.error);
      }
    });
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isPending}
      aria-pressed={fav}
      aria-label={fav ? "Remove from favourites" : "Mark as favourite"}
      title={fav ? "Favourited" : "Mark as favourite"}
      className={cn(
        "inline-flex items-center justify-center rounded-md p-1 transition-colors hover:bg-muted/50 disabled:opacity-50",
        className,
      )}
    >
      <Star
        style={{ width: size, height: size }}
        className={cn(
          "transition-colors",
          fav
            ? "fill-amber-400 text-amber-400"
            : "text-muted-foreground hover:text-amber-400",
        )}
      />
    </button>
  );
}
