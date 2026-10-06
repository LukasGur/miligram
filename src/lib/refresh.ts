"use client";

import { refreshAllQueries } from "./remoteQuery";
import { reloadTo } from "./screenLoad";

/**
 * Obnova potažením dolů.
 *
 * Měkká: stáhne znovu data obrazovky, na kterou se člověk dívá, a řekne
 * výměně se serverem (SyncAgent), ať odešle čekající lekce a stáhne
 * novinky. Nic nepřeblikne a člověk zůstane, kde byl.
 *
 * Když to do limitu nedoběhne, nebo na obrazovce visí načítání, které
 * nedoběhlo samo, je spojení po probuzení z pozadí mrtvé (src/lib/supabase.ts)
 * a pomůže jen nový start. Aplikace se pak přenačte rovnou na obrazovku,
 * kde člověk je. Dřív to musel udělat sám zavřením aplikace.
 */
export const REFRESH_EVENT = "miligram:refresh";

/** Jak dlouho smí obnova trvat, než se aplikace přenačte. */
const REFRESH_LIMIT_MS = 6_000;
/**
 * Nejkratší otočka kolečka. Obnova bez účtu nemá co stahovat a skončila by
 * dřív, než se kolečko stihne ukázat; to by vypadalo, že se nic nestalo.
 */
const MIN_SPIN_MS = 600;

/**
 * Načítání, které právě visí na obrazovce (src/components/ui/StuckLoading.tsx).
 * Obnova ho nemusí znát — čeká třeba na přihlášení, ne na dotaz — a proto
 * se přihlašuje samo.
 */
let waiting = 0;

export function holdWaiting(): () => void {
  waiting += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    waiting -= 1;
  };
}

export type RefreshOutcome = "done" | "reloading";

/** `target` je adresa obrazovky pro přenačtení; nese ji `data-refresh`. */
export async function refreshScreen(target: string): Promise<RefreshOutcome> {
  const startedAt = Date.now();
  const stuckBefore = waiting > 0;
  window.dispatchEvent(new Event(REFRESH_EVENT));

  let timer: number | undefined;
  const limit = new Promise<"timeout">((resolve) => {
    timer = window.setTimeout(() => resolve("timeout"), REFRESH_LIMIT_MS);
  });
  const result = await Promise.race([refreshAllQueries(), limit]);
  window.clearTimeout(timer);

  // Bez sítě nový start nic nespraví; o výpadku mluví proužek sítě.
  const dead = navigator.onLine && (result === "timeout" || result === false || stuckBefore);
  if (dead && reloadTo(target)) return "reloading";

  const rest = MIN_SPIN_MS - (Date.now() - startedAt);
  if (rest > 0) await new Promise((resolve) => window.setTimeout(resolve, rest));
  return "done";
}
