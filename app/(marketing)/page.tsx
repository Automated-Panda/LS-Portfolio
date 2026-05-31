// app/(marketing)/page.tsx
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getMarketingStats } from "@/lib/marketing/stats";

import { Hero } from "@/components/marketing/hero";
import { StatBar } from "@/components/marketing/stat-bar";
import { FeatureCards } from "@/components/marketing/feature-cards";
import { OrganizerSpotlight } from "@/components/marketing/organizer-spotlight";
import { ScreenshotShowcase } from "@/components/marketing/screenshot-showcase";
import { PricingTeaser } from "@/components/marketing/pricing-teaser";
import { Faq } from "@/components/marketing/faq";
import { FinalCta } from "@/components/marketing/final-cta";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  const stats = await getMarketingStats();

  return (
    <>
      <Hero />
      <StatBar stats={stats} />
      <FeatureCards />
      <OrganizerSpotlight />
      <ScreenshotShowcase />
      <PricingTeaser />
      <Faq />
      <FinalCta />
    </>
  );
}
