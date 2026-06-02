// components/marketing/final-cta.tsx
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Section } from "./section";

export function FinalCta() {
  return (
    <Section>
      <div className="rounded-2xl border border-neutral-800 bg-[#101010] px-6 py-16 text-center">
        <h2 className="mx-auto max-w-xl text-3xl font-extrabold tracking-tight text-neutral-100 md:text-4xl">
          Start tracking your empire
        </h2>
        <p className="mx-auto mt-3 max-w-md text-neutral-400">
          Free to start, no card required. Set up your portfolio in minutes and
          see your whole GTA V empire come together.
        </p>
        <div className="mt-8">
          <Button
            asChild
            size="lg"
            className="bg-[#84cc16] text-black hover:bg-[#84cc16]/90"
          >
            <Link href="/signup">Get started free</Link>
          </Button>
        </div>
      </div>
    </Section>
  );
}
