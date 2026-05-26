import Link from "next/link";
import { Plus, Sparkles, Home } from "lucide-react";

import { Card } from "@/components/ui/card";

export function QuickActions() {
  return (
    <Card className="border-accent/30 bg-accent/5">
      <div className="flex flex-wrap items-center gap-3 p-4">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          ⚡ Quick actions
        </span>
        <Link
          href="/vehicles"
          className="inline-flex items-center gap-1.5 rounded-md border border-accent/40 bg-background/40 px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent/20"
        >
          <Plus className="h-3.5 w-3.5" /> Vehicle
        </Link>
        <Link
          href="/properties"
          className="inline-flex items-center gap-1.5 rounded-md border border-accent/40 bg-background/40 px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent/20"
        >
          <Home className="h-3.5 w-3.5" /> Property
        </Link>
        <Link
          href="/organize"
          className="inline-flex items-center gap-1.5 rounded-md border border-accent/40 bg-background/40 px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent/20"
        >
          <Sparkles className="h-3.5 w-3.5" /> Organize
        </Link>
      </div>
    </Card>
  );
}
