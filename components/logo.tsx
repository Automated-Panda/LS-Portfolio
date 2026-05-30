import Image from "next/image";

import { cn } from "@/lib/utils";

type LogoSize = "sm" | "md" | "lg" | "xl";
type LogoTheme = "dark" | "light";

type LogoProps = {
  className?: string;
  size?: LogoSize;
  // Kept for API compatibility. The lockup is the white/green transparent
  // mark, designed for the dark UI; no separate light variant today.
  theme?: LogoTheme;
};

// public/logo.png is the horizontal "GT VAULT" lockup (600×192, ratio ~3.13:1).
const RATIO = 600 / 192;
const WIDTHS: Record<LogoSize, number> = {
  sm: 120,
  md: 180,
  lg: 300,
  xl: 420,
};

export function Logo({ className, size = "md" }: LogoProps) {
  const width = WIDTHS[size];
  const height = Math.round(width / RATIO);

  return (
    <Image
      src="/logo.png"
      alt="GT Vault"
      width={width}
      height={height}
      priority={size === "xl"}
      sizes={`${width}px`}
      className={cn("select-none", className)}
    />
  );
}
