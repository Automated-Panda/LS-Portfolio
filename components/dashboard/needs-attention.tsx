"use client";

import Link from "next/link";
import { AlertTriangle, Clock, Copy, X } from "lucide-react";
import { useEffect, useState } from "react";

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

// Per-device dismissal state. Count notices store the count at dismissal time
// so they re-surface only when the count climbs higher; the undo-plan notice
// stores the plan id so a brand-new plan re-surfaces. Resolved notices (count
// 0 / no plan) reset, so a fresh occurrence isn't suppressed by a stale value.
const DISMISS_KEY = "dashboard:attention:dismissed";
type Dismissed = {
  unassigned?: number;
  duplicates?: number;
  undoPlanId?: string;
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
  // Starts empty so the server render and first client render match (every
  // notice visible); the effect then applies any saved dismissals.
  const [dismissed, setDismissed] = useState<Dismissed>({});

  useEffect(() => {
    let saved: Dismissed = {};
    try {
      const raw = localStorage.getItem(DISMISS_KEY);
      if (raw) saved = JSON.parse(raw) as Dismissed;
    } catch {
      // Ignore malformed / unavailable storage — just show everything.
    }
    // Drop thresholds for notices that are now resolved so a fresh occurrence
    // re-appears instead of being hidden by an old, higher count.
    const cleaned: Dismissed = { ...saved };
    if (unassignedVehicles === 0) delete cleaned.unassigned;
    if (duplicateVehicles === 0) delete cleaned.duplicates;
    if (!activeUndoPlan) delete cleaned.undoPlanId;
    setDismissed(cleaned);
    if (JSON.stringify(cleaned) !== JSON.stringify(saved)) {
      try {
        localStorage.setItem(DISMISS_KEY, JSON.stringify(cleaned));
      } catch {
        // best-effort
      }
    }
  }, [unassignedVehicles, duplicateVehicles, activeUndoPlan]);

  const persist = (next: Dismissed) => {
    setDismissed(next);
    try {
      localStorage.setItem(DISMISS_KEY, JSON.stringify(next));
    } catch {
      // best-effort
    }
  };

  const showUnassigned =
    unassignedVehicles > 0 && unassignedVehicles > (dismissed.unassigned ?? 0);
  const showDuplicates =
    duplicateVehicles > 0 && duplicateVehicles > (dismissed.duplicates ?? 0);
  const showUndo =
    !!activeUndoPlan && dismissed.undoPlanId !== activeUndoPlan.id;

  if (!showUnassigned && !showDuplicates && !showUndo) return null;

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
          {showUnassigned && (
            <AttentionRow
              href="/my-vehicles?unassigned=1"
              cta="→ Assign or organize"
              onDismiss={() =>
                persist({ ...dismissed, unassigned: unassignedVehicles })
              }
              dismissLabel="Dismiss unassigned-vehicles notice"
            >
              <span>
                <span className="font-semibold tabular-nums">
                  {unassignedVehicles}
                </span>{" "}
                unassigned {unassignedVehicles === 1 ? "vehicle" : "vehicles"}
              </span>
            </AttentionRow>
          )}
          {showDuplicates && (
            <AttentionRow
              href="/my-vehicles?duplicates=1"
              cta="→ Review"
              onDismiss={() =>
                persist({ ...dismissed, duplicates: duplicateVehicles })
              }
              dismissLabel="Dismiss duplicate-vehicles notice"
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
            </AttentionRow>
          )}
          {showUndo && activeUndoPlan && (
            <AttentionRow
              href="/organize"
              cta="→ Review"
              onDismiss={() =>
                persist({ ...dismissed, undoPlanId: activeUndoPlan.id })
              }
              dismissLabel="Dismiss applied-plan notice"
            >
              <span className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                Plan applied {relativeTime(activeUndoPlan.appliedAt)} — undo
                expires {relativeTime(activeUndoPlan.expiresAt)}
              </span>
            </AttentionRow>
          )}
        </div>
      </div>
    </Card>
  );
}

/**
 * One attention notice: a clickable Link (the bulk of the row) plus a sibling
 * dismiss button. The button is a Link sibling — not nested inside it — so we
 * never put an interactive control inside an anchor.
 */
function AttentionRow({
  href,
  cta,
  onDismiss,
  dismissLabel,
  children,
}: {
  href: string;
  cta: string;
  onDismiss: () => void;
  dismissLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="group flex items-center rounded-md transition-colors hover:bg-amber-500/10">
      <Link
        href={href}
        className="flex flex-1 items-center justify-between px-2 py-1.5"
      >
        {children}
        <span className="text-xs text-muted-foreground">{cta}</span>
      </Link>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={dismissLabel}
        title="Dismiss"
        className="mr-1 ml-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-amber-500/20 hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
