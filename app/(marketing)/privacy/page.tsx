// app/(marketing)/privacy/page.tsx
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy · GT Vault" };

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-20">
      <h1 className="text-3xl font-bold text-neutral-100">Privacy Policy</h1>
      <p className="mt-4 text-neutral-400">
        GT Vault stores the GTA V assets you choose to track, tied to your
        account. We don&apos;t sell your data. A full privacy policy will be
        published here before public launch.
      </p>
    </div>
  );
}
