import { cn } from "@/lib/utils";

type LogoSize = "sm" | "md" | "lg" | "xl";
type LogoTheme = "dark" | "light";

type LogoProps = {
  className?: string;
  size?: LogoSize;
  theme?: LogoTheme;
};

const SIZES: Record<
  LogoSize,
  { ls: string; stars: string; word: string; gap: string; stack: string }
> = {
  sm: {
    ls: "text-2xl",
    stars: "text-[10px]",
    word: "text-[8px]",
    gap: "gap-1.5",
    stack: "gap-0.5",
  },
  md: {
    ls: "text-4xl",
    stars: "text-sm",
    word: "text-[10px]",
    gap: "gap-2",
    stack: "gap-0.5",
  },
  lg: {
    ls: "text-6xl",
    stars: "text-xl",
    word: "text-sm",
    gap: "gap-3",
    stack: "gap-1",
  },
  xl: {
    ls: "text-8xl",
    stars: "text-3xl",
    word: "text-lg",
    gap: "gap-4",
    stack: "gap-1.5",
  },
};

export function Logo({ className, size = "md", theme = "dark" }: LogoProps) {
  const s = SIZES[size];
  const lsColor = theme === "dark" ? "text-neutral-100" : "text-neutral-950";
  const starColor = theme === "dark" ? "text-amber-400" : "text-amber-600";
  const wordColor = theme === "dark" ? "text-neutral-400" : "text-neutral-600";

  return (
    <span
      className={cn(
        "inline-flex items-center font-display leading-none",
        s.gap,
        className,
      )}
      aria-label="LS Portfolio"
      role="img"
    >
      <span className={cn(s.ls, lsColor)} aria-hidden>
        LS
      </span>
      <span className={cn("flex flex-col", s.stack)} aria-hidden>
        <span className={cn(s.stars, starColor, "tracking-[0.05em]")}>
          ★★★★★
        </span>
        <span className={cn(s.word, wordColor, "tracking-[0.22em]")}>
          PORTFOLIO
        </span>
      </span>
    </span>
  );
}
