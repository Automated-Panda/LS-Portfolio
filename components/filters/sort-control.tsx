"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const SORT_OPTIONS = [
  { value: "default", label: "Sort: Default" },
  { value: "price-asc", label: "Price: Low → High" },
  { value: "price-desc", label: "Price: High → Low" },
  { value: "name", label: "Name: A → Z" },
] as const;

/**
 * Sort dropdown. Self-contained — reads/writes the `sort` URL param so it drops
 * into any filter bar. Browse components read `sort` and order accordingly.
 */
export function SortControl() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const sort = searchParams.get("sort") ?? "default";

  const update = (value: string) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value === "default") next.delete("sort");
    else next.set("sort", value);
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return (
    <Select value={sort} onValueChange={update}>
      <SelectTrigger className="w-[170px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SORT_OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
