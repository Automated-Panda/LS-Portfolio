import Link from "next/link";

import { Button } from "@/components/ui/button";

export function MyBusinessesEmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed p-12 text-center">
      <p className="text-lg font-semibold">No businesses yet</p>
      <p className="max-w-md text-sm text-muted-foreground">
        Track your nightclubs, bunkers, MC clubhouses, biker businesses,
        offices, hangars, and more here. Browse the catalogue to mark what
        you own.
      </p>
      <div className="flex gap-2">
        <Button asChild>
          <Link href="/businesses">Browse businesses</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/wizard">Open onboarding wizard</Link>
        </Button>
      </div>
    </div>
  );
}
