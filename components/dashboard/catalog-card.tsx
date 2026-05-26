import { Trophy } from "lucide-react";

import { Card } from "@/components/ui/card";

type Row = { ownedUnique: number; total: number; percent: number };

type Props = {
  vehicles: Row;
  properties: Row;
};

function ProgressRow({
  label,
  row,
}: {
  label: string;
  row: Row;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums">
          {row.ownedUnique} / {row.total}{" "}
          <span className="text-muted-foreground">({row.percent}%)</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full bg-accent transition-all"
          style={{ width: `${row.percent}%` }}
        />
      </div>
    </div>
  );
}

export function CatalogCard({ vehicles, properties }: Props) {
  return (
    <Card>
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Trophy className="h-4 w-4" />
          <span className="text-xs uppercase tracking-wider font-medium">
            Catalog
          </span>
        </div>
        <ProgressRow label="Vehicles" row={vehicles} />
        <ProgressRow label="Properties" row={properties} />
        <p className="text-xs text-muted-foreground">
          Unique types owned out of the GTA V catalog.
        </p>
      </div>
    </Card>
  );
}
