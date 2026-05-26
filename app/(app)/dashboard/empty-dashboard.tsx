import Link from "next/link";
import { Car, Home, Sparkles, Wand2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type Props = {
  userName: string | null;
};

export function EmptyDashboard({ userName }: Props) {
  const greeting = userName
    ? `Welcome to LS Portfolio, ${userName}.`
    : "Welcome to LS Portfolio.";

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      <div className="text-center pt-4">
        <h1 className="text-3xl font-semibold tracking-tight">{greeting}</h1>
        <p className="mt-2 text-muted-foreground">
          Let&apos;s build your portfolio.
        </p>
      </div>

      <Card className="border-accent/40 bg-accent/5">
        <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
          <Wand2 className="h-8 w-8 text-accent-foreground" />
          <CardTitle>Run the setup wizard</CardTitle>
          <CardDescription>
            Walk through your properties, then add the vehicles stored at each
            one. Fastest way to get started.
          </CardDescription>
          <Button asChild size="lg" className="mt-2">
            <Link href="/wizard">Start setup wizard</Link>
          </Button>
        </CardContent>
      </Card>

      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
          Or jump straight in
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Link href="/vehicles" className="block">
            <Card className="h-full transition-colors hover:bg-accent/20">
              <CardContent className="flex flex-col gap-2 p-4">
                <Car className="h-5 w-5 text-accent-foreground" />
                <CardTitle className="text-base">Browse all vehicles</CardTitle>
                <CardDescription className="text-xs">
                  Pick from 800+ vehicles in the GTA V catalog and mark what
                  you own.
                </CardDescription>
              </CardContent>
            </Card>
          </Link>

          <Link href="/properties" className="block">
            <Card className="h-full transition-colors hover:bg-accent/20">
              <CardContent className="flex flex-col gap-2 p-4">
                <Home className="h-5 w-5 text-accent-foreground" />
                <CardTitle className="text-base">Browse properties</CardTitle>
                <CardDescription className="text-xs">
                  166 properties — apartments, garages, businesses.
                </CardDescription>
              </CardContent>
            </Card>
          </Link>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="block cursor-not-allowed">
                  <Card className="h-full opacity-50">
                    <CardContent className="flex flex-col gap-2 p-4">
                      <Sparkles className="h-5 w-5 text-accent-foreground" />
                      <CardTitle className="text-base">
                        Try the AI organizer
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Natural-language portfolio organization.
                      </CardDescription>
                    </CardContent>
                  </Card>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                Add vehicles + a property first.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
}
