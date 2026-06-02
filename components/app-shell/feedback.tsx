// components/app-shell/feedback.tsx
"use client";

import { MessageSquarePlus, X } from "lucide-react";
import { createContext, useContext, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { CATEGORIES } from "@/lib/support/tickets";
import { submitFeedback } from "@/lib/support/feedback-actions";

type FeedbackContextValue = { open: () => void };
const FeedbackContext = createContext<FeedbackContextValue | null>(null);

export function useFeedback(): FeedbackContextValue {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error("useFeedback must be used within FeedbackProvider");
  return ctx;
}

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <FeedbackContext.Provider value={{ open: () => setIsOpen(true) }}>
      {children}
      <FeedbackWidget open={isOpen} onOpenChange={setIsOpen} />
    </FeedbackContext.Provider>
  );
}

function FeedbackWidget({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [category, setCategory] = useState(CATEGORIES[0].value);
  const [message, setMessage] = useState("");
  const [relatedItem, setRelatedItem] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  const reset = () => {
    setCategory(CATEGORIES[0].value);
    setMessage("");
    setRelatedItem("");
    setError(null);
    setDone(false);
  };

  const close = () => {
    onOpenChange(false);
    setTimeout(reset, 200);
  };

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = await submitFeedback({ category, message, relatedItem });
      if ("error" in res) setError(res.error);
      else setDone(true);
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => onOpenChange(true)}
        aria-label="Send feedback"
        className="fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-[#84cc16] text-black shadow-lg transition-transform hover:scale-105"
      >
        <MessageSquarePlus className="h-5 w-5" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={close}
        >
          <div
            className="w-full max-w-md rounded-lg border bg-card p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-semibold">Send feedback</h2>
              <button type="button" onClick={close} aria-label="Close">
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            {done ? (
              <div className="py-6 text-center">
                <p className="text-sm">Thanks! Your feedback has been sent. 🙌</p>
                <Button className="mt-4" onClick={close}>
                  Done
                </Button>
              </div>
            ) : (
              <>
                <label className="mt-4 block text-sm font-medium">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>

                <label className="mt-3 block text-sm font-medium">Message</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  placeholder="Tell us what's on your mind…"
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                />

                <label className="mt-3 block text-sm font-medium">
                  Related item <span className="text-muted-foreground">(optional)</span>
                </label>
                <input
                  value={relatedItem}
                  onChange={(e) => setRelatedItem(e.target.value)}
                  placeholder="e.g. a vehicle name or page"
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                />

                {error && <p className="mt-2 text-sm text-red-500">{error}</p>}

                <div className="mt-5 flex justify-end gap-2">
                  <Button variant="outline" onClick={close} disabled={pending}>
                    Cancel
                  </Button>
                  <Button onClick={submit} disabled={pending}>
                    {pending ? "Sending…" : "Send"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
