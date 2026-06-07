"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { createProfileSlotCheckout } from "@/app/(app)/credits/actions";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  MAX_CHARACTERS_PER_PROFILE,
  type CharacterSwitcherData,
} from "@/lib/characters-shared";
import {
  createCharacter,
  createProfile,
  deleteCharacter,
  deleteProfile,
  renameCharacter,
  renameProfile,
  setActiveCharacter,
  setProfileGtaPlus,
} from "./actions";

type DeleteTarget =
  | { kind: "character"; id: string; name: string; summary: string }
  | { kind: "profile"; id: string; name: string; summary: string };

export function CharactersManager({ data }: { data: CharacterSwitcherData }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [del, setDel] = useState<DeleteTarget | null>(null);
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (params.get("status") === "slot-success") {
      toast.success("Profile slot unlocked — you can add another GTA account now.");
    }
  }, [params]);

  const onlyOneProfile = data.profiles.length <= 1;
  const totalCharacters = data.profiles.reduce((n, p) => n + p.characters.length, 0);

  const run = (fn: () => Promise<{ ok: true } | { error: string } | { ok: true; id: string }>) =>
    startTransition(async () => {
      const r = await fn();
      if (r && "error" in r) {
        if (r.error === "needs-purchase") {
          const co = await createProfileSlotCheckout();
          if ("url" in co) window.location.href = co.url;
          else toast.error(co.error);
        } else toast.error(r.error);
      } else {
        router.refresh();
      }
    });

  const confirmDelete = () => {
    if (!del || typed !== "DELETE") return;
    const target = del;
    setDel(null);
    setTyped("");
    run(() =>
      target.kind === "character"
        ? deleteCharacter(target.id)
        : deleteProfile(target.id),
    );
  };

  return (
    <div className="flex flex-col gap-3">
      {data.profiles.map((p) => (
        <div key={p.id} className="overflow-hidden rounded-xl border bg-card">
          {/* Profile header */}
          <div className="flex items-center gap-2 border-b bg-muted/30 p-3">
            <Input
              defaultValue={p.name}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== p.name) run(() => renameProfile(p.id, v));
              }}
              className="h-9 w-44 font-semibold"
            />
            <button
              type="button"
              onClick={() => run(() => setProfileGtaPlus(p.id, !p.gtaPlus))}
              className="ml-auto flex items-center gap-2 text-xs text-muted-foreground"
              title="GTA+ applies to both characters in this profile"
            >
              GTA+
              <span
                className={`relative h-[18px] w-[34px] rounded-full transition-colors ${
                  p.gtaPlus ? "bg-gradient-to-r from-amber-400 to-amber-500" : "bg-muted-foreground/30"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white transition-all ${
                    p.gtaPlus ? "left-[18px]" : "left-0.5"
                  }`}
                />
              </span>
            </button>
            <button
              type="button"
              disabled={onlyOneProfile || pending}
              onClick={() =>
                setDel({
                  kind: "profile",
                  id: p.id,
                  name: p.name,
                  summary: `${p.characters.length} character${p.characters.length === 1 ? "" : "s"} and all their vehicles & properties`,
                })
              }
              className="ml-1 text-muted-foreground/60 hover:text-red-400 disabled:opacity-30"
              title={onlyOneProfile ? "Can't delete your only profile" : "Delete profile"}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          {/* Characters */}
          {p.characters.map((ch) => {
            const isActive = ch.id === data.activeCharacterId;
            return (
              <div key={ch.id} className="flex items-center gap-3 border-b px-3 py-2.5 last:border-b-0">
                <span
                  className={`relative h-3 w-3 shrink-0 rounded-full border-2 ${
                    isActive ? "border-emerald-400" : "border-muted-foreground/40"
                  }`}
                >
                  {isActive && <span className="absolute inset-[2px] rounded-full bg-emerald-400" />}
                </span>
                <Input
                  defaultValue={ch.name}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== ch.name) run(() => renameCharacter(ch.id, v));
                  }}
                  className="h-8 w-36 text-sm"
                />
                <span className="text-xs text-muted-foreground">
                  {ch.vehicleCount} vehicles · {ch.propertyCount} properties
                </span>
                <div className="ml-auto flex items-center gap-3">
                  {isActive ? (
                    <span className="rounded-full border border-emerald-500/40 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                      active
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => run(() => setActiveCharacter(ch.id))}
                      className="text-xs text-sky-400 hover:text-sky-300"
                    >
                      Set active
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={totalCharacters <= 1 || pending}
                    onClick={() =>
                      setDel({
                        kind: "character",
                        id: ch.id,
                        name: ch.name,
                        summary: `${ch.vehicleCount} vehicles + ${ch.propertyCount} properties`,
                      })
                    }
                    className="text-muted-foreground/60 hover:text-red-400 disabled:opacity-30"
                    title={totalCharacters <= 1 ? "Can't delete your only character" : "Delete character"}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}

          {p.characters.length < MAX_CHARACTERS_PER_PROFILE && (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => createCharacter(p.id))}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-xs text-muted-foreground hover:bg-muted/30 hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5" /> Add character — starts a blank slate
              <span className="ml-auto text-[10px] text-muted-foreground/60">
                {p.characters.length} / {MAX_CHARACTERS_PER_PROFILE}
              </span>
            </button>
          )}
        </div>
      ))}

      <Button
        variant="outline"
        className="h-11 justify-start gap-2 border-dashed"
        disabled={pending}
        onClick={() => run(() => createProfile())}
      >
        <Plus className="h-4 w-4" /> Add GTA-account profile
        {!data.isOwner && (
          <span className="ml-auto rounded-full border border-emerald-500/40 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
            $2.99
          </span>
        )}
      </Button>

      {/* Typed-DELETE confirm */}
      <Dialog
        open={del !== null}
        onOpenChange={(o) => {
          if (!o) {
            setDel(null);
            setTyped("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete “{del?.name}”?</DialogTitle>
            <DialogDescription>
              This permanently removes {del?.summary}. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="Type DELETE to confirm"
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDel(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={typed !== "DELETE"}
              onClick={confirmDelete}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
