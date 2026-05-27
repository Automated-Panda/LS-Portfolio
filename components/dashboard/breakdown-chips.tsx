import Link from "next/link";
import { BarChart3 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

type ChipRow = Array<{ label: string; count: number; href: string }>;

type Props = {
  vehicleClasses: ChipRow;
};

function ChipList({ rows }: { rows: ChipRow }) {
  if (rows.length === 0) {
    return (
      <span className="text-xs text-muted-foreground">No data yet.</span>
    );
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {rows.map((r) => (
        <Link key={r.label} href={r.href}>
          <Badge
            variant="secondary"
            className="cursor-pointer hover:bg-accent/30 transition-colors"
          >
            {r.label}{" "}
            <span className="ml-1 font-semibold tabular-nums">{r.count}</span>
          </Badge>
        </Link>
      ))}
    </div>
  );
}

export function BreakdownChips({ vehicleClasses }: Props) {
  return (
    <Card>
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <BarChart3 className="h-4 w-4" />
          <span className="text-xs uppercase tracking-wider font-medium">
            Portfolio breakdown
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">Vehicles by class</p>
          <ChipList rows={vehicleClasses} />
        </div>
      </div>
    </Card>
  );
}
