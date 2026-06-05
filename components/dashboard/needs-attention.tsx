import Link from "next/link";
import { AlertTriangle, Clock, Copy } from "lucide-react";

import { Card } from "@/components/ui/card";

type Props = {
  unassignedVehicles: number;
  duplicateVehicles: number;
  activeUndoPlan: {
    id: string;
    appliedAt: string;     // ISO
    expiresAt: string;     // ISO
  } | null;
};

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.round((then - now) / 1000);
  const abs = Math.abs(diffSec);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (abs < 60) return rtf.format(diffSec, "second");
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  return rtf.format(Math.round(diffSec / 86400), "day");
}

export function NeedsAttention({
  unassignedVehicles,
  duplicateVehicles,
  activeUndoPlan,
}: Props) {
  if (
    unassignedVehicles === 0 &&
    duplicateVehicles === 0 &&
    activeUndoPlan === null
  )
    return null;

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <div className="flex flex-col gap-2 p-4">
        <div className="flex items-center gap-2 text-amber-500">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-xs uppercase tracking-wider font-medium">
            Needs attention
          </span>
        </div>
        <div className="flex flex-col gap-1.5 text-sm">
          {unassignedVehicles > 0 && (
            <Link
              href="/my-vehicles?unassigned=1"
              className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-amber-500/10 transition-colors"
            >
              <span>
                <span className="font-semibold tabular-nums">
                  {unassignedVehicles}
                </span>{" "}
                unassigned {unassignedVehicles === 1 ? "vehicle" : "vehicles"}
              </span>
              <span className="text-xs text-muted-foreground">
                → Assign or organize
              </span>
            </Link>
          )}
          {duplicateVehicles > 0 && (
            <Link
              href="/my-vehicles?duplicates=1"
              className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-amber-500/10 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                <span>
                  <span className="font-semibold tabular-nums">
                    {duplicateVehicles}
                  </span>{" "}
                  duplicate {duplicateVehicles === 1 ? "vehicle" : "vehicles"}{" "}
                  <span className="text-muted-foreground">(own 2+ of)</span>
                </span>
              </span>
              <span className="text-xs text-muted-foreground">→ Review</span>
            </Link>
          )}
          {activeUndoPlan && (
            <Link
              href="/organize"
              className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-amber-500/10 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                Plan applied {relativeTime(activeUndoPlan.appliedAt)} — undo
                expires {relativeTime(activeUndoPlan.expiresAt)}
              </span>
              <span className="text-xs text-muted-foreground">→ Review</span>
            </Link>
          )}
        </div>
      </div>
    </Card>
  );
}
