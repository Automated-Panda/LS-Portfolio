// app/(app)/organize/thinking-bubble.tsx
"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

const PHASES = [
  "Reading your portfolio…",
  "Understanding the request…",
  "Planning the moves…",
];

export function ThinkingBubble() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % PHASES.length), 1600);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex max-w-[88%] gap-2">
      <Sparkles className="mt-1 h-4 w-4 shrink-0 text-[#84cc16]" />
      <div className="rounded-[14px_14px_14px_4px] border border-[#262626] bg-[#161616] px-3.5 py-2.5">
        <div className="mb-1 flex gap-1 motion-reduce:hidden">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#84cc16] [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#84cc16] [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#84cc16]" />
        </div>
        <p className="text-xs text-neutral-400 motion-reduce:hidden">{PHASES[i]}</p>
        <p className="hidden text-xs text-neutral-400 motion-reduce:block">Working…</p>
      </div>
    </div>
  );
}
