"use client";

import { Check, Pencil, X } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { UserHighlight } from "@/lib/queries/highlights";

import {
  deleteHighlight,
  renameHighlight,
} from "./highlights-actions";

type Props = {
  highlights: UserHighlight[];
};

export function ManageHighlights({ highlights }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [isPending, startTransition] = useTransition();

  const startEdit = (tag: string) => {
    setEditing(tag);
    setDraft(tag);
  };

  const cancelEdit = () => {
    setEditing(null);
    setDraft("");
  };

  const commitRename = (oldTag: string) => {
    const next = draft.trim();
    if (!next || next === oldTag) {
      cancelEdit();
      return;
    }
    startTransition(async () => {
      const r = await renameHighlight(oldTag, next);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success(
        `Renamed "${oldTag}" → "${next}" on ${r.updated} vehicle${r.updated === 1 ? "" : "s"}.`,
      );
      cancelEdit();
    });
  };

  const handleDelete = (tag: string, usage: number) => {
    if (
      !confirm(
        `Remove "${tag}" from ${usage} vehicle${usage === 1 ? "" : "s"}? This can't be undone.`,
      )
    )
      return;
    startTransition(async () => {
      const r = await deleteHighlight(tag);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success(`Removed "${tag}" from ${r.updated} vehicle${r.updated === 1 ? "" : "s"}.`);
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Manage Highlights</CardTitle>
        <CardDescription>
          Your custom vehicle tags. Rename to fix casing or typos; deleting
          removes the tag from every vehicle that has it. To add a tag,
          open any vehicle&apos;s detail drawer and type into the Highlights
          field — casing is preserved exactly as you type.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {highlights.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You haven&apos;t added any highlights yet. Open a vehicle in{" "}
            <span className="font-mono text-xs">/my-vehicles</span> and add
            tags from the Highlights button.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border/40">
            {highlights.map((h) => (
              <li
                key={h.tag}
                className="flex items-center gap-2 py-2 text-sm"
              >
                {editing === h.tag ? (
                  <>
                    <Input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          commitRename(h.tag);
                        } else if (e.key === "Escape") {
                          e.preventDefault();
                          cancelEdit();
                        }
                      }}
                      autoFocus
                      disabled={isPending}
                      className="h-8 flex-1"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => commitRename(h.tag)}
                      disabled={isPending}
                      className="h-8 w-8"
                      aria-label="Save rename"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={cancelEdit}
                      disabled={isPending}
                      className="h-8 w-8"
                      aria-label="Cancel rename"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 truncate">{h.tag}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {h.usage} {h.usage === 1 ? "vehicle" : "vehicles"}
                    </Badge>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => startEdit(h.tag)}
                      disabled={isPending}
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      aria-label={`Rename ${h.tag}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(h.tag, h.usage)}
                      disabled={isPending}
                      className="h-8 w-8 text-muted-foreground hover:bg-red-500/10 hover:text-red-300"
                      aria-label={`Delete ${h.tag}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
