import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8 text-center">
      <div className="space-y-4">
        <h1 className="text-5xl font-bold tracking-tight">LS Portfolio</h1>
        <p className="max-w-md text-lg text-muted-foreground">
          Track your full GTA V asset portfolio — vehicles, properties,
          businesses, aircraft, and everything else you own.
        </p>
      </div>
      <div className="flex gap-3">
        <Button asChild size="lg">
          <Link href="/signup">Get started</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Early access — Phase 2 build.
      </p>
    </main>
  );
}
