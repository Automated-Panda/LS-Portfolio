"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

type Props = {
  email: string | null;
};

/**
 * Polls for a session every 3 seconds. If the user confirms in another tab
 * (most common case — the email link opens a new tab) the cookie is shared
 * across tabs, so this poll picks up the new session and auto-redirects.
 *
 * Hard fallback: a "Sign in" link they can click manually if they confirmed
 * on a different device or browser.
 */
export function CheckEmailClient({ email }: Props) {
  const router = useRouter();
  const [pollCount, setPollCount] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    // Initial check (handles the case where they clicked the email link in
    // a new tab inside the same browser and switched back here).
    const check = async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      if (data.user) {
        router.replace("/wizard");
      } else {
        setPollCount((n) => n + 1);
      }
    };

    void check();
    const id = window.setInterval(check, 3000);

    // onAuthStateChange fires immediately for SIGNED_IN events from any tab
    // when @supabase/ssr's cookie storage syncs. This is the FAST path; the
    // 3s poll is the slow safety net.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" && !cancelled) {
        router.replace("/wizard");
      }
    });

    return () => {
      cancelled = true;
      window.clearInterval(id);
      sub.subscription.unsubscribe();
    };
  }, [router]);

  return (
    <div className="space-y-4">
      <Alert>
        <AlertDescription>
          Waiting for confirmation… we&apos;ll sign you in automatically as soon as you click
          the link.
        </AlertDescription>
      </Alert>

      <p className="text-xs text-muted-foreground">
        {pollCount > 0 && `Checked ${pollCount} ${pollCount === 1 ? "time" : "times"} · `}
        Email not arrived?{" "}
        <Link
          href={email ? `/signup?email=${encodeURIComponent(email)}` : "/signup"}
          className="text-foreground hover:underline"
        >
          Try a different address
        </Link>
        .
      </p>

      <div className="border-t pt-3">
        <p className="mb-2 text-xs text-muted-foreground">
          Already confirmed on another device?
        </p>
        <Button asChild variant="outline" className="w-full">
          <Link href="/login">Sign in instead →</Link>
        </Button>
      </div>
    </div>
  );
}
