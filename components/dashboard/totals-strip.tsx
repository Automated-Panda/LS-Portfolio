import Link from "next/link";
import { Car, Home, Briefcase } from "lucide-react";

import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";

type SubSplit = Array<{ label: string; count: number }>;

type Props = {
  vehicles: { total: number; splits: SubSplit };
  properties: { total: number; splits: SubSplit };
  businesses: { total: number; splits: SubSplit };
};

function formatSplits(splits: SubSplit): string {
  return splits
    .filter((s) => s.count > 0)
    .map((s) => `${s.count} ${s.label}`)
    .join(" · ");
}

function StatCard({
  href, icon: Icon, label, total, subLine,
}: {
  href: string;
  icon: typeof Car;
  label: string;
  total: number;
  subLine: string;
}) {
  return (
    <Link
      href={href}
      className="block transition-colors hover:bg-accent/40 rounded-lg"
    >
      <Card>
        <CardContent className="flex items-center gap-4 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent/30">
            <Icon className="h-5 w-5 text-accent-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <CardDescription className="text-xs uppercase tracking-wider">
              {label}
            </CardDescription>
            <CardTitle className="text-3xl tabular-nums">{total}</CardTitle>
            {subLine && (
              <p className="text-xs text-muted-foreground truncate">{subLine}</p>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export function TotalsStrip({ vehicles, properties, businesses }: Props) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <StatCard
        href="/my-vehicles"
        icon={Car}
        label="Vehicles"
        total={vehicles.total}
        subLine={formatSplits(vehicles.splits)}
      />
      <StatCard
        href="/my-properties"
        icon={Home}
        label="Properties"
        total={properties.total}
        subLine={formatSplits(properties.splits)}
      />
      <StatCard
        href="/my-businesses"
        icon={Briefcase}
        label="Businesses"
        total={businesses.total}
        subLine={formatSplits(businesses.splits)}
      />
    </div>
  );
}
