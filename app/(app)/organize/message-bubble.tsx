// app/(app)/organize/message-bubble.tsx
import { Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

type Props = {
  role: "user" | "assistant";
  children: React.ReactNode;
  className?: string;
};

/**
 * One chat bubble. User messages: brand-green, right-aligned. Assistant:
 * dark surface with a Sparkles avatar, left-aligned. Children carry the text
 * or a rich card (plan / clarification).
 */
export function MessageBubble({ role, children, className }: Props) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div
          className={cn(
            "max-w-[80%] rounded-[14px_14px_4px_14px] bg-[#84cc16] px-3.5 py-2.5 text-sm font-medium text-black",
            className,
          )}
        >
          {children}
        </div>
      </div>
    );
  }
  return (
    <div className="flex max-w-[88%] gap-2">
      <Sparkles className="mt-1 h-4 w-4 shrink-0 text-[#84cc16]" />
      <div
        className={cn(
          "rounded-[14px_14px_14px_4px] border border-[#262626] bg-[#161616] px-3.5 py-2.5 text-sm text-neutral-200",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
