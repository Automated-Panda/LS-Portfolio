// components/marketing/section.tsx
import { cn } from "@/lib/utils";

type SectionProps = {
  id?: string;
  eyebrow?: string;
  className?: string;
  children: React.ReactNode;
};

/**
 * Marketing section wrapper: centered max-width column, consistent vertical
 * rhythm, optional uppercase brand-green eyebrow label.
 */
export function Section({ id, eyebrow, className, children }: SectionProps) {
  return (
    <section
      id={id}
      className={cn("mx-auto w-full max-w-6xl px-6 py-20 md:py-28", className)}
    >
      {eyebrow && (
        <p className="mb-3 text-center font-display text-xs uppercase tracking-[0.28em] text-[#84cc16]">
          {eyebrow}
        </p>
      )}
      {children}
    </section>
  );
}
