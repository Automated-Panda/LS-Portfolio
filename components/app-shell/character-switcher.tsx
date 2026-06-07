"use client";

import { ChevronDown, Gamepad2, Plus, Settings2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  createCharacter,
  createProfile,
  setActiveCharacter,
} from "@/app/(app)/characters/actions";
import { createProfileSlotCheckout } from "@/app/(app)/credits/actions";
import {
  MAX_CHARACTERS_PER_PROFILE,
  type CharacterSwitcherData,
} from "@/lib/characters-shared";
import { cn } from "@/lib/utils";

export function CharacterSwitcher({ data }: { data: CharacterSwitcherData }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const active = data.profiles
    .flatMap((p) => p.characters.map((c) => ({ ...c, profile: p })))
    .find((c) => c.id === data.activeCharacterId);

  const run = (fn: () => Promise<unknown>) => {
    setOpen(false);
    startTransition(async () => {
      await fn();
      router.refresh();
    });
  };

  const switchTo = (id: string) => {
    if (id === data.activeCharacterId) return setOpen(false);
    run(async () => {
      const r = await setActiveCharacter(id);
      if ("error" in r) toast.error(r.error);
    });
  };

  const addCharacter = (profileId: string) =>
    run(async () => {
      const r = await createCharacter(profileId);
      if ("error" in r) toast.error(r.error);
      else {
        toast.success("New character — blank slate ready");
        router.push("/dashboard");
      }
    });

  const addProfile = () =>
    run(async () => {
      const r = await createProfile();
      if ("error" in r) {
        if (r.error === "needs-purchase") {
          const co = await createProfileSlotCheckout();
          if ("url" in co) window.location.href = co.url;
          else toast.error(co.error);
          return;
        }
        toast.error(r.error);
      } else {
        toast.success("New GTA-account profile added");
        router.push("/dashboard");
      }
    });

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={pending}
        className="flex items-center gap-2 rounded-full border bg-muted/40 px-3 py-1.5 text-sm transition-colors hover:bg-muted disabled:opacity-60"
      >
        <Gamepad2 className="h-4 w-4 text-emerald-400" />
        <span className="font-medium">{active?.name ?? "Character"}</span>
        <span className="hidden text-muted-foreground sm:inline">· {active?.profile.name}</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      {open && (
        <>
          <button
            aria-label="Close"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 z-50 mt-1.5 w-80 overflow-hidden rounded-xl border bg-card shadow-xl">
            <p className="px-3 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Switch character
            </p>
            <div className="max-h-[60vh] overflow-y-auto">
              {data.profiles.map((p) => (
                <div key={p.id} className="border-t first:border-t-0">
                  <div className="flex items-center gap-2 bg-muted/30 px-3 py-1.5">
                    <span className="text-[11px] font-bold">{p.name}</span>
                    {p.gtaPlus && (
                      <span className="rounded bg-gradient-to-r from-amber-400 to-amber-500 px-1.5 text-[8px] font-extrabold text-black">
                        GTA+
                      </span>
                    )}
                    <Link
                      href="/characters"
                      onClick={() => setOpen(false)}
                      className="ml-auto text-muted-foreground hover:text-foreground"
                      aria-label={`Manage ${p.name}`}
                    >
                      <Settings2 className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                  {p.characters.map((ch) => {
                    const isActive = ch.id === data.activeCharacterId;
                    return (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => switchTo(ch.id)}
                        className={cn(
                          "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50",
                          isActive && "bg-emerald-500/10",
                        )}
                      >
                        <span
                          className={cn(
                            "relative h-3.5 w-3.5 shrink-0 rounded-full border-2",
                            isActive ? "border-emerald-400" : "border-muted-foreground/40",
                          )}
                        >
                          {isActive && (
                            <span className="absolute inset-[3px] rounded-full bg-emerald-400" />
                          )}
                        </span>
                        <span className="font-medium">{ch.name}</span>
                        <span className="ml-auto text-right text-[10px] leading-tight text-muted-foreground">
                          {ch.vehicleCount} vehicles
                          <br />
                          {ch.propertyCount} properties
                        </span>
                      </button>
                    );
                  })}
                  {p.characters.length < MAX_CHARACTERS_PER_PROFILE && (
                    <button
                      type="button"
                      onClick={() => addCharacter(p.id)}
                      className="flex w-full items-center gap-2 px-3 py-1.5 pl-3 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add character
                      <span className="ml-auto text-[10px] text-muted-foreground/60">
                        {p.characters.length} / {MAX_CHARACTERS_PER_PROFILE}
                      </span>
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="border-t bg-muted/10">
              <button
                type="button"
                onClick={addProfile}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-sm hover:bg-muted/50"
              >
                <Plus className="h-4 w-4" /> Add GTA-account profile
                {!data.isOwner && (
                  <span className="ml-auto rounded-full border border-emerald-500/40 px-1.5 text-[10px] font-bold text-emerald-400">
                    $2.99
                  </span>
                )}
              </button>
              <Link
                href="/characters"
                onClick={() => setOpen(false)}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-sm hover:bg-muted/50"
              >
                <Settings2 className="h-4 w-4" /> Manage profiles &amp; characters
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
