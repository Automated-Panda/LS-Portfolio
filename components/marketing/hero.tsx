// components/marketing/hero.tsx
import Link from "next/link";
import Image from "next/image";

import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 pb-12 pt-20 text-center md:pt-28">
      <p className="font-display text-xs uppercase tracking-[0.28em] text-[#84cc16]">
        GTA V Asset Tracker
      </p>
      <p
        className="mt-3 text-sm tracking-[0.45em] text-[#84cc16]"
        aria-hidden="true"
      >
        ★★★★★
      </p>
      <h1 className="mx-auto mt-5 max-w-2xl text-4xl font-extrabold leading-[1.08] tracking-tight text-neutral-100 md:text-6xl">
        Track your entire GTA&nbsp;V empire
      </h1>
      <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-neutral-400 md:text-lg">
        Vehicles, properties, businesses, aircraft &amp; boats — your whole
        portfolio and its net worth, in one place.
      </p>
      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Button
          asChild
          size="lg"
          className="bg-[#84cc16] text-black hover:bg-[#84cc16]/90"
        >
          <Link href="/signup">Get started free</Link>
        </Button>
        <Button
          asChild
          size="lg"
          variant="outline"
          className="border-neutral-700 bg-transparent text-neutral-100 hover:bg-neutral-900 hover:text-neutral-100"
        >
          <a href="#features">See features</a>
        </Button>
      </div>

      <div className="mx-auto mt-16 max-w-4xl">
        <div className="overflow-hidden rounded-xl border border-neutral-800 bg-[#101010] shadow-[0_0_80px_rgba(132,204,22,0.08)]">
          <Image
            src="/marketing/dashboard.webp"
            alt="GT Vault dashboard showing net worth, vehicle and property counts, and catalog coverage"
            width={1600}
            height={900}
            priority
            className="h-auto w-full"
          />
        </div>
      </div>
    </section>
  );
}
