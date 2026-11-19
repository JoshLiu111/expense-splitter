"use client";

// PROTOTYPE (JoshLiu111/issue-track#19): throwaway, never merged to main.
// Three directions for the Group page on the existing Guest Group route,
// switchable via ?variant=A|B|C, ?hero=open|small|settled|empty and
// ?you=1 (signed-in perspective as the seed's largest debtor) from a floating bar.
// Hero states are derived from the seed Group in memory; nothing is saved.

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { GroupSnapshot } from "@/domain";
import { cn } from "@/lib/utils";
import { groupInState, pickYou, HERO_LABELS, HERO_STATES, type HeroState } from "./prototype-data";
import { name as nameA, VariantA } from "./variant-a-statement";
import { name as nameB, VariantB } from "./variant-b-workbench";
import { name as nameC, VariantC } from "./variant-c-focus";

const VARIANTS = {
  A: { name: nameA, Component: VariantA },
  B: { name: nameB, Component: VariantB },
  C: { name: nameC, Component: VariantC },
};
type Key = keyof typeof VARIANTS;
const KEYS = Object.keys(VARIANTS) as Key[];

export function GroupPagePrototype({ seed }: { seed: GroupSnapshot }) {
  const params = useSearchParams();
  const variant = (KEYS.find((k) => k === params.get("variant")) ?? "A") as Key;
  const hero = (HERO_STATES.find((h) => h === params.get("hero")) ?? "open") as HeroState;
  const asYou = params.get("you") === "1";
  const group = groupInState(seed, hero);
  const Variant = VARIANTS[variant].Component;

  return (
    <>
      {/* key: reset view state (tabs, filters) on every switch. */}
      <Variant key={`${variant}-${hero}`} group={group} youId={asYou ? pickYou(seed) : undefined} />
      {process.env.NODE_ENV !== "production" && (
        <PrototypeSwitcher variant={variant} hero={hero} asYou={asYou} />
      )}
    </>
  );
}

function PrototypeSwitcher({ variant, hero, asYou }: { variant: Key; hero: HeroState; asYou: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function set(patch: Record<string, string>) {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) next.set(k, v);
    router.replace(`${pathname}?${next}`, { scroll: false });
  }
  const cycle = (step: number) => set({ variant: KEYS[(KEYS.indexOf(variant) + step + KEYS.length) % KEYS.length] });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === "ArrowLeft") cycle(-1);
      if (e.key === "ArrowRight") cycle(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div
      data-prototype-switcher
      className="fixed bottom-2 left-1/2 z-50 flex max-w-[calc(100%-1rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-1 rounded-2xl bg-black px-2 py-1 text-xs text-white shadow-lg ring-2 ring-fuchsia-500"
    >
      <button aria-label="Previous variant" onClick={() => cycle(-1)} className="rounded p-1 hover:bg-white/20">
        <ChevronLeft className="size-4" />
      </button>
      <span className="min-w-28 text-center font-bold">
        {variant} ({VARIANTS[variant].name})
      </span>
      <button aria-label="Next variant" onClick={() => cycle(1)} className="rounded p-1 hover:bg-white/20">
        <ChevronRight className="size-4" />
      </button>
      <span className="mx-1 h-4 w-px bg-white/30" />
      {HERO_STATES.map((h) => (
        <button
          key={h}
          onClick={() => set({ hero: h })}
          className={cn("rounded px-2 py-1", hero === h ? "bg-white text-black" : "hover:bg-white/20")}
        >
          {HERO_LABELS[h]}
        </button>
      ))}
      <span className="mx-1 h-4 w-px bg-white/30" />
      <button
        onClick={() => set({ you: asYou ? "0" : "1" })}
        className={cn("rounded px-2 py-1", asYou ? "bg-white text-black" : "hover:bg-white/20")}
      >
        {asYou ? "Signed in" : "Guest"}
      </button>
    </div>
  );
}
