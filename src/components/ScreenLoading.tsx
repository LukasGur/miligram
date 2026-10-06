"use client";

import { StuckLoading } from "@/components/ui/StuckLoading";

/**
 * Místo obrazovky, jejíž kód se ještě stahuje. Dřív tu nebylo nic a po
 * zaseknutém stažení zůstala bílá plocha, o které nešlo poznat, jestli
 * aplikace ještě žije. `target` je adresa, na kterou se aplikace přenačte.
 */
export function ScreenLoading({ target }: { target: string }) {
  return <StuckLoading target={target} screen />;
}
