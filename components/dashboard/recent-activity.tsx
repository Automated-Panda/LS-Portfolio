import Link from "next/link";
import { Bot, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { PlanSummaryRow } from "@/lib/queries/organizer";

type Props = {
  plans: PlanSummaryRow[];
};

function statusVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "applied":
    case "completed":
      return "default";
    case "checklist":
      return "secondary";
    case "failed":
      return "destructive";
    default:
      return "outline";
  }
}

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

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

export function RecentActivity({ plans }: Props) {
  return (
    <Card>
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Bot className="h-4 w-4" />
            <span className="text-xs uppercase tracking-wider font-medium">
              Recent organizer activity
            </span>
          </div>
          <Link
            href="/organize"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            View all →
          </Link>
        </div>

        {plans.length === 0 ? (
          <Link
            href="/organize"
            className="flex items-center gap-2 rounded-md border border-dashed border-muted-foreground/20 p-3 text-sm text-muted-foreground hover:bg-accent/20 transition-colors"
          >
            <Sparkles className="h-4 w-4 text-accent-foreground" />
            No organizer activity yet — try the AI Organizer
          </Link>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {plans.map((p) => (
              <li key={p.id}>
                <Link
                  href="/organize"
                  className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-accent/20 transition-colors"
                >
                  <span className="flex-1 min-w-0 truncate">
                    {truncate(p.prompt, 60)}
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                    <span>
                      {p.completed_count}/{p.step_count} steps
                    </span>
                    <Badge variant={statusVariant(p.status)} className="text-[10px]">
                      {p.status}
                    </Badge>
                    <span className="tabular-nums">
                      {relativeTime(p.created_at)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
