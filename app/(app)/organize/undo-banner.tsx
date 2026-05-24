"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { undoPlan } from "./actions";

type Props = {
  planId: string;
  undoExpiresAt: string;       // ISO timestamp
  carsMoved: number;
};

export function UndoBanner({ planId, undoExpiresAt, carsMoved }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [secondsLeft, setSecondsLeft] = useState<number>(
    Math.max(0, Math.floor((new Date(undoExpiresAt).getTime() - Date.now()) / 1000)),
  );

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [secondsLeft]);

  if (secondsLeft <= 0) return null;

  const mins = Math.floor(secondsLeft / 60).toString().padStart(2, "0");
  const secs = (secondsLeft % 60).toString().padStart(2, "0");

  const handleUndo = () => {
    startTransition(async () => {
      const r = await undoPlan(planId);
      if ("ok" in r) {
        toast.success("Reverted to pre-apply state.");
        router.refresh();
      } else {
        toast.error(`Undo failed: ${r.error}`);
      }
    });
  };

  return (
    <div className="flex items-center justify-between rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-3">
      <p className="text-sm">
        ✅ <strong>Plan applied</strong> · {carsMoved} car{carsMoved === 1 ? "" : "s"} moved
      </p>
      <Button
        size="sm"
        variant="outline"
        onClick={handleUndo}
        disabled={pending}
        className="border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/20"
      >
        ↶ Undo ({mins}:{secs})
      </Button>
    </div>
  );
}
