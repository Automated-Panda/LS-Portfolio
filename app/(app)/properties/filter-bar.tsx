"use client";

import { X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

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
  PropertyType,
} from "@/lib/properties";
import { formatPropertyType } from "@/lib/properties";
import { cn } from "@/lib/utils";

export function FilterBar({ filters }: { filters: PropertyFilterOptions }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const q = searchParams.get("q") ?? "";
  const type = searchParams.get("type") ?? "";
  const loc = searchParams.get("loc") ?? "";

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

  const setType = (next: PropertyType | "") =>
    update({ type: next || null });

  const hasAny = q || type || loc;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search properties…"
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          className="max-w-xs"
        />

        {filters.locations.length > 0 && (
          <Select
            value={loc || "__all"}
            onValueChange={(v) => update({ loc: v === "__all" ? null : v })}
          >
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All locations</SelectItem>
              {filters.locations.map((l) => (
                <SelectItem key={l} value={l}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

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
    </div>
  );
}
