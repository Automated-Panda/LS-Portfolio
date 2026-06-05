"use client";

import { ChevronsUpDown, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatMoneyCompact } from "@/lib/format";

/** Parse "100k", "1.5m", "$975,000", "8000" → integer dollars (or null). */
export function parsePriceInput(raw: string): number | null {
  const t = raw.trim().toLowerCase().replace(/[$,\s]/g, "");
  if (!t) return null;
  const m = t.match(/^(\d+(?:\.\d+)?)(k|m)?$/);
  if (!m) return null;
  let n = parseFloat(m[1]);
  if (m[2] === "k") n *= 1_000;
  else if (m[2] === "m") n *= 1_000_000;
  return Number.isFinite(n) ? Math.round(n) : null;
}

const PRESETS: Array<{ label: string; min: number | null; max: number | null }> = [
  { label: "Under $100k", min: null, max: 100_000 },
  { label: "$100k–$1M", min: 100_000, max: 1_000_000 },
  { label: "$1M–$5M", min: 1_000_000, max: 5_000_000 },
  { label: "Over $5M", min: 5_000_000, max: null },
];

function triggerLabel(min: number | null, max: number | null): string {
  if (min !== null && max !== null)
    return `${formatMoneyCompact(min)}–${formatMoneyCompact(max)}`;
  if (min !== null) return `≥ ${formatMoneyCompact(min)}`;
  if (max !== null) return `≤ ${formatMoneyCompact(max)}`;
  return "Price";
}

/**
 * Price-range filter. Self-contained — reads/writes the `pmin`/`pmax` URL
 * params (integer dollars) so it drops into any filter bar. Browse components
 * read the same params to filter.
 */
export function PriceFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  const pmin = searchParams.get("pmin");
  const pmax = searchParams.get("pmax");
  const min = pmin ? Number(pmin) : null;
  const max = pmax ? Number(pmax) : null;
  const active = min !== null || max !== null;

  const [minDraft, setMinDraft] = useState(pmin ?? "");
  const [maxDraft, setMaxDraft] = useState(pmax ?? "");
  useEffect(() => setMinDraft(pmin ?? ""), [pmin]);
  useEffect(() => setMaxDraft(pmax ?? ""), [pmax]);

  const write = useCallback(
    (nextMin: number | null, nextMax: number | null) => {
      const next = new URLSearchParams(searchParams.toString());
      if (nextMin === null) next.delete("pmin");
      else next.set("pmin", String(nextMin));
      if (nextMax === null) next.delete("pmax");
      else next.set("pmax", String(nextMax));
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [searchParams, router, pathname],
  );

  const applyDrafts = () => {
    write(parsePriceInput(minDraft), parsePriceInput(maxDraft));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[150px] justify-between font-normal"
        >
          <span className="truncate">{triggerLabel(min, max)}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Input
              inputMode="numeric"
              placeholder="Min"
              value={minDraft}
              onChange={(e) => setMinDraft(e.target.value)}
              onBlur={applyDrafts}
              onKeyDown={(e) => e.key === "Enter" && applyDrafts()}
              className="h-9"
            />
            <span className="text-muted-foreground">–</span>
            <Input
              inputMode="numeric"
              placeholder="Max"
              value={maxDraft}
              onChange={(e) => setMaxDraft(e.target.value)}
              onBlur={applyDrafts}
              onKeyDown={(e) => e.key === "Enter" && applyDrafts()}
              className="h-9"
            />
          </div>
          <p className="text-[10px] text-muted-foreground">
            Accepts shorthand — e.g. 100k, 1.5m
          </p>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => {
              const isActive = p.min === min && p.max === max;
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => write(p.min, p.max)}
                  className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                    isActive
                      ? "border-emerald-500/70 bg-emerald-500/15 text-emerald-300"
                      : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          {active && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => write(null, null)}
              className="h-8 self-start px-2 text-muted-foreground"
            >
              <X className="mr-1 h-3.5 w-3.5" /> Clear price
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
