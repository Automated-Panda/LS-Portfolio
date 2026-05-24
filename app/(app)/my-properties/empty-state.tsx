import Link from "next/link";

import { Button } from "@/components/ui/button";

export function MyPropertiesEmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed p-12 text-center">
      <p className="text-lg font-semibold">No properties yet</p>
      <p className="max-w-md text-sm text-muted-foreground">
        Walk through the onboarding wizard for a guided setup, or browse the
        property catalogue to mark what you own.
      </p>
      <div className="flex gap-2">
        <Button asChild>
          <Link href="/wizard">Open onboarding wizard</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/properties">Browse properties</Link>
        </Button>
      </div>
    </div>
  );
}
