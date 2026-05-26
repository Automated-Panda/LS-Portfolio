import { Target } from "lucide-react";

import { Card } from "@/components/ui/card";

type Props = {
  used: number;
  total: number;
  percent: number;
};

export function CapacityCard({ used, total, percent }: Props) {
  const empty = total === 0;
  return (
    <Card>
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Target className="h-4 w-4" />
          <span className="text-xs uppercase tracking-wider font-medium">
            Capacity
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-semibold tabular-nums">
              {empty ? "—" : `${used} / ${total}`}
            </span>
            <span className="text-sm text-muted-foreground tabular-nums">
              {empty ? "" : `${percent}%`}
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-accent transition-all"
              style={{ width: `${empty ? 0 : percent}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {empty
              ? "No properties owned yet."
              : "Garage slots used across all properties."}
          </p>
        </div>
      </div>
    </Card>
  );
}
