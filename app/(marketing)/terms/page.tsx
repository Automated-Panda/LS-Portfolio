// app/(marketing)/terms/page.tsx
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms · GT Vault" };

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-20">
      <h1 className="text-3xl font-bold text-neutral-100">Terms of Use</h1>
      <p className="mt-4 text-neutral-400">
        GT Vault is a free, fan-made tool provided as-is, and is not affiliated
        with Rockstar Games or Take-Two Interactive. Full terms will be
        published here before public launch.
      </p>
    </div>
  );
}
