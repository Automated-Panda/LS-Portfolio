// components/marketing/faq.tsx
import { Section } from "./section";

const FAQS = [
  {
    q: "Is it free?",
    a: "Yes — tracking and valuing your portfolio is completely free, forever, and there's no card required to sign up. The only thing that costs money is the AI Organizer, which runs on credits. Every account gets free credits to start and a top-up each month.",
  },
  {
    q: "What are credits and what do they cost?",
    a: "Credits power the AI Organizer. Each plan it generates costs around 5 credits. You start with 20 bonus credits, get 10 more free every month, and can buy more whenever you like — a $4.99 Starter pack is 50 credits (roughly 10 plans), or go Pro for $9.99/mo and get 250 fresh credits every month.",
  },
  {
    q: "Do I have to pay for the AI Organizer?",
    a: "Not to try it — your free monthly credits cover light use. You only pay if you want to run it heavily. Everything else in GT Vault stays free regardless.",
  },
  {
    q: "Can I cancel my subscription?",
    a: "Anytime, from your billing page. Your Pro credits stay available until the end of the period you've already paid for, and any one-off credit packs you've bought never expire.",
  },
  {
    q: "Is this affiliated with Rockstar or Take-Two?",
    a: "No. GT Vault is a fan-made, unofficial tool. It is not affiliated with, endorsed by, or sponsored by Rockstar Games.",
  },
  {
    q: "Does it connect to my GTA account or sync automatically?",
    a: "No — there is no Rockstar API. You mark what you own manually, and GT Vault keeps track of it for you.",
  },
  {
    q: "What platforms does it cover?",
    a: "GTA V / GTA Online. The catalog data is universal, so it works whether you play on PC or console.",
  },
  {
    q: "Is my data safe?",
    a: "Your portfolio is tied to your account and private to you. You can wipe it any time from your profile.",
  },
];

export function Faq() {
  return (
    <Section id="faq" eyebrow="FAQ">
      <h2 className="text-center text-3xl font-bold tracking-tight text-neutral-100 md:text-4xl">
        Questions &amp; answers
      </h2>
      <div className="mx-auto mt-10 max-w-2xl divide-y divide-neutral-800 border-y border-neutral-800">
        {FAQS.map((item) => (
          <details key={item.q} className="group py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between text-neutral-100">
              <span className="font-medium">{item.q}</span>
              <span className="ml-4 text-[#84cc16] transition-transform group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-neutral-400">
              {item.a}
            </p>
          </details>
        ))}
      </div>
    </Section>
  );
}
