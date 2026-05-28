"use client";

import { ChevronsUpDown, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  AssetCategory,
  AvailabilityStatus,
  FilterOptions,
} from "@/lib/vehicles";
import {
  ASSET_CATEGORIES,
  ASSET_CATEGORY_LABEL,
  AVAILABILITY_LABEL,
  VENDOR_LABEL,
  VENDOR_OPTIONS,
  assetCategoryOf,
} from "@/lib/vehicles";

const AVAILABILITY_OPTIONS: AvailabilityStatus[] = [
  "available",
  "discontinued",
  "unobtainable",
  "blacklisted",
  "seasonal",
];
import { cn } from "@/lib/utils";

export function FilterBar({ filters }: { filters: FilterOptions }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mfrOpen, setMfrOpen] = useState(false);

  const q = searchParams.get("q") ?? "";
  const cls = searchParams.get("class") ?? "";
  const mfr = searchParams.get("mfr") ?? "";
  const cat = (searchParams.get("cat") ?? "") as AssetCategory | "";
  const avail = searchParams.get("avail") ?? "";
  const vendor = searchParams.get("vendor") ?? "";
  const selectedTags = (searchParams.get("tags") ?? "")
    .split(",")
    .filter(Boolean);

  // Local search state — URL write is debounced so every keystroke doesn't
  // trigger a full grid re-render.
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

  const toggleTag = (tagId: string) => {
    const isSelected = selectedTags.includes(tagId);
    const next = isSelected
      ? selectedTags.filter((t) => t !== tagId)
      : [...selectedTags, tagId];
    update({ tags: next.join(",") || null });
  };

  const selectedMfr = filters.manufacturers.find((m) => m.id === mfr);
  const hasAny = q || cls || mfr || cat || avail || vendor || selectedTags.length > 0;

  // Classes available in the currently-selected category — switching to Air
  // narrows the Class dropdown to Plane/Helicopter, etc.
  const visibleClasses = cat
    ? filters.classes.filter((c) => assetCategoryOf(c) === cat)
    : filters.classes;

  const setCategory = (next: AssetCategory | "") => {
    // Clear class filter when switching category so a stale "Muscle" doesn't
    // persist into Air and zero out results.
    update({ cat: next || null, class: null });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setCategory("")}
          className="focus:outline-none"
        >
          <Badge
            variant={!cat ? "default" : "outline"}
            className={cn(
              "cursor-pointer transition-colors",
              cat && "hover:bg-accent",
            )}
          >
            All
          </Badge>
        </button>
        {ASSET_CATEGORIES.map((c) => {
          const active = cat === c;
          return (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className="focus:outline-none"
            >
              <Badge
                variant={active ? "default" : "outline"}
                className={cn(
                  "cursor-pointer transition-colors",
                  !active && "hover:bg-accent",
                )}
              >
                {ASSET_CATEGORY_LABEL[c]}
              </Badge>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search vehicles…"
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          className="max-w-xs"
        />

        <Select
          value={cls || "__all"}
          onValueChange={(v) =>
            update({ class: v === "__all" ? null : v })
          }
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Class" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">All classes</SelectItem>
            {visibleClasses.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={avail || "__all"}
          onValueChange={(v) => update({ avail: v === "__all" ? null : v })}
        >
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Availability" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">All availability</SelectItem>
            {AVAILABILITY_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {AVAILABILITY_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={vendor || "__all"}
          onValueChange={(v) => update({ vendor: v === "__all" ? null : v })}
        >
          <SelectTrigger className="w-[190px]">
            <SelectValue placeholder="Vendor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">All vendors</SelectItem>
            {VENDOR_OPTIONS.map((vn) => (
              <SelectItem key={vn} value={vn}>
                {VENDOR_LABEL[vn]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Popover open={mfrOpen} onOpenChange={setMfrOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={mfrOpen}
              className="w-[220px] justify-between font-normal"
            >
              <span className="truncate">
                {selectedMfr ? selectedMfr.display : "All manufacturers"}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[240px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search manufacturer…" />
              <CommandList>
                <CommandEmpty>No manufacturer found.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    onSelect={() => {
                      update({ mfr: null });
                      setMfrOpen(false);
                    }}
                  >
                    All manufacturers
                  </CommandItem>
                  {filters.manufacturers.map((m) => (
                    <CommandItem
                      key={m.id}
                      value={m.display}
                      onSelect={() => {
                        update({ mfr: m.id });
                        setMfrOpen(false);
                      }}
                    >
                      {m.display}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

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

      {filters.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {filters.tags.map((tag) => {
            const active = selectedTags.includes(tag.id);
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleTag(tag.id)}
                className="focus:outline-none"
              >
                <Badge
                  variant={active ? "default" : "outline"}
                  className={cn(
                    "cursor-pointer transition-colors",
                    !active && "hover:bg-accent",
                  )}
                >
                  {tag.display}
                </Badge>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
