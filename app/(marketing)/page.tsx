// app/(marketing)/page.tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getMarketingStats } from "@/lib/marketing/stats";

import { Hero } from "@/components/marketing/hero";
import { StatBar } from "@/components/marketing/stat-bar";
import { FeatureCards } from "@/components/marketing/feature-cards";
import { OrganizerSpotlight } from "@/components/marketing/organizer-spotlight";
import { ScreenshotShowcase } from "@/components/marketing/screenshot-showcase";
import { Pricing } from "@/components/marketing/pricing";
import { Faq } from "@/components/marketing/faq";
import { FinalCta } from "@/components/marketing/final-cta";

export const metadata: Metadata = {
  title: "GT Vault — Track your entire GTA V empire",
  description:
    "Track your full GTA V asset portfolio — vehicles, properties, businesses, aircraft and boats — see your net worth, and organize your garages with AI. Free to start.",
  openGraph: {
    title: "GT Vault — Track your entire GTA V empire",
    description:
      "Your full GTA V portfolio and its net worth, in one place, with AI-powered garage organization. Free to start.",
    url: "https://www.gtvault.app",
    siteName: "GT Vault",
    images: [{ url: "/marketing/og.webp", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "GT Vault — Track your entire GTA V empire",
    description:
      "Your full GTA V portfolio and its net worth, in one place. Free to use.",
    images: ["/marketing/og.webp"],
  },
};

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
      <Pricing />
      <Faq />
      <FinalCta />
    </>
  );
}
