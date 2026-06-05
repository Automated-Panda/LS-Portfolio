"use client";

import { X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  PropertyFilterOptions,
  PropertySummary,
  PropertyType,
} from "@/lib/properties";
import { formatPropertyType } from "@/lib/properties";
import { cn } from "@/lib/utils";
import { PriceFilter } from "@/components/filters/price-filter";
import { SortControl } from "@/components/filters/sort-control";

type Props = {
  filters: PropertyFilterOptions;
  /** Slim slice of all properties — used to compute which subtypes are
   *  present for the currently selected type filter. */
  propertiesIndex: Pick<PropertySummary, "subtype" | "property_type">[];
  searchPlaceholder?: string;
};

export function FilterBar({
  filters,
  propertiesIndex,
  searchPlaceholder = "Search properties…",
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const q = searchParams.get("q") ?? "";
  const type = searchParams.get("type") ?? "";
  const subtype = searchParams.get("subtype") ?? "";
  const nbhd = searchParams.get("nbhd") ?? "";

  const [searchDraft, setSearchDraft] = useState(q);
  useEffect(() => {
    setSearchDraft(q);
  }, [q]);

  const update = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      }
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [searchParams, router, pathname],
  );

  useEffect(() => {
    if (searchDraft === q) return;
    const handle = setTimeout(() => {
      update({ q: searchDraft || null });
    }, 200);
    return () => clearTimeout(handle);
  }, [searchDraft, q, update]);

  // Derive which subtypes are present given the active type filter.
  // We map subtype ids → display labels from filters.subtypes, but only
  // include subtypes that actually appear in the (type-filtered) property index.
  const visibleSubtypes = useMemo(() => {
    const subtypeSet = new Set<string>();
    for (const p of propertiesIndex) {
      if (!type || p.property_type === type) {
        subtypeSet.add(p.subtype);
      }
    }
    return filters.subtypes.filter((s) => subtypeSet.has(s.id));
  }, [propertiesIndex, filters.subtypes, type]);

  const setType = (next: PropertyType | "") => {
    // When the type changes, check if the current subtype is still represented.
    // If not, clear it.
    const incomingTypeSubtypes = new Set(
      propertiesIndex
        .filter((p) => !next || p.property_type === next)
        .map((p) => p.subtype),
    );
    const subtypeToClear = subtype && !incomingTypeSubtypes.has(subtype);
    update({ type: next || null, ...(subtypeToClear ? { subtype: null } : {}) });
  };

  const hasAny =
    q ||
    type ||
    subtype ||
    nbhd ||
    searchParams.get("pmin") ||
    searchParams.get("pmax") ||
    searchParams.get("sort");

  return (
    <div className="space-y-3">
      {/* Type pill row — only shown when 2+ types are in scope */}
      {filters.types.length >= 2 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setType("")}
            className="focus:outline-none"
          >
            <Badge
              variant={!type ? "default" : "outline"}
              className={cn(
                "cursor-pointer transition-colors",
                type && "hover:bg-accent",
              )}
            >
              All
            </Badge>
          </button>
          {filters.types.map((t) => {
            const active = type === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className="focus:outline-none"
              >
                <Badge
                  variant={active ? "default" : "outline"}
                  className={cn(
                    "cursor-pointer transition-colors",
                    !active && "hover:bg-accent",
                  )}
                >
                  {formatPropertyType(t)}
                </Badge>
              </button>
            );
          })}
        </div>
      )}

      {/* Subtype pill row — only shown when 2+ subtypes are available */}
      {visibleSubtypes.length >= 2 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => update({ subtype: null })}
            className="focus:outline-none"
          >
            <Badge
              variant={!subtype ? "default" : "outline"}
              className={cn(
                "cursor-pointer transition-colors",
                subtype && "hover:bg-accent",
              )}
            >
              All types
            </Badge>
          </button>
          {visibleSubtypes.map((s) => {
            const active = subtype === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => update({ subtype: active ? null : s.id })}
                className="focus:outline-none"
              >
                <Badge
                  variant={active ? "default" : "outline"}
                  className={cn(
                    "cursor-pointer transition-colors",
                    !active && "hover:bg-accent",
                  )}
                >
                  {s.display}
                </Badge>
              </button>
            );
          })}
        </div>
      )}

      {/* Search + neighborhood + clear */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder={searchPlaceholder}
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          className="max-w-xs"
        />

        {filters.neighborhoods.length > 0 && (
          <Select
            value={nbhd || "__all"}
            onValueChange={(v) => update({ nbhd: v === "__all" ? null : v })}
          >
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Neighborhood" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All neighborhoods</SelectItem>
              {filters.neighborhoods.map((n) => (
                <SelectItem key={n} value={n}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <PriceFilter />

        <SortControl />

        {hasAny && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.replace(pathname, { scroll: false })}
          >
            <X className="mr-1 h-4 w-4" />
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}
