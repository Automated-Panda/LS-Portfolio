import { DollarSign } from "lucide-react";

import { Card } from "@/components/ui/card";
import { formatMoneyCompact, formatMoneyFull } from "@/lib/format";

type Props = {
  total: number;
  vehicles: number;
  properties: number;
  upgrades: number;
  /** Vehicles + properties + upgrades with no price sourced yet. */
  unpricedItems: number;
  /** Names of the unpriced owned items, grouped by type, for the expandable list. */
  unpriced: {
    vehicles: string[];
    properties: string[];
    upgrades: string[];
  };
};

export function NetWorthCard({
  total,
  vehicles,
  properties,
  upgrades,
  unpricedItems,
  unpriced,
}: Props) {
  return (
    <Card className="border-emerald-500/40 bg-gradient-to-br from-emerald-500/10 via-accent/5 to-transparent">
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-center gap-2 text-emerald-400">
          <DollarSign className="h-4 w-4" />
          <span className="text-xs uppercase tracking-wider font-medium">
            Net worth
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <span
            className="text-4xl font-semibold tabular-nums"
            title={formatMoneyFull(total)}
          >
            {formatMoneyCompact(total)}
          </span>
          <span className="text-xs text-muted-foreground">
            Sum of catalogue prices across everything you own.
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3 pt-2 border-t border-emerald-500/15">
          <Breakdown label="Vehicles" amount={vehicles} />
          <Breakdown label="Properties" amount={properties} />
          <Breakdown label="Upgrades" amount={upgrades} />
        </div>

        {unpricedItems > 0 && (
          <details className="group/unpriced text-[10px] text-muted-foreground">
            <summary className="cursor-pointer list-none marker:hidden hover:text-foreground">
              <span className="inline-block transition-transform group-open/unpriced:rotate-90">
                ▸
              </span>{" "}
              {unpricedItems} item{unpricedItems === 1 ? "" : "s"} missing a
              price — actual net worth is higher.
            </summary>
            <div className="mt-2 flex flex-col gap-1.5 pl-3">
              <UnpricedGroup label="Vehicles" items={unpriced.vehicles} />
              <UnpricedGroup label="Properties" items={unpriced.properties} />
              <UnpricedGroup label="Upgrades" items={unpriced.upgrades} />
            </div>
          </details>
        )}
      </div>
    </Card>
  );
}

function UnpricedGroup({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <span className="font-medium text-foreground/70">{label}:</span>{" "}
      <span>{items.join(", ")}</span>
    </div>
  );
}

function Breakdown({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span
        className="text-sm font-medium tabular-nums"
        title={formatMoneyFull(amount)}
      >
        {formatMoneyCompact(amount)}
      </span>
    </div>
  );
}
