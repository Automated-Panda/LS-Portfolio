import Link from "next/link";

import { Button } from "@/components/ui/button";

export function UnassignedBanner({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <div className="flex items-center justify-between rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3">
      <p className="text-sm">
        <strong>{count}</strong> {count === 1 ? "car needs" : "cars need"} a home.
      </p>
      <Button asChild size="sm">
        <Link href="/wizard">Set up storage →</Link>
      </Button>
    </div>
  );
}
