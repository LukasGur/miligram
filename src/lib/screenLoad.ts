"use client";

/**
 * Načtení kódu obrazovky s pojistkou.
 *
 * Profil, statistiky, program i lekce se stahují až po klepnutí. iOS
 * aplikaci na ploše po desítkách minut na pozadí probudí s mrtvým spojením
 * (viz src/lib/supabase.ts) a stažení pak nikdy nedoběhne: dashboard byl
 * vidět, po klepnutí na profil zbyla bílá obrazovka a pomohl až restart.
 *
 * Proto limit. Když kód do limitu nedorazí nebo stažení spadne, aplikace
 * se přenačte rovnou na cílovou obrazovku. Nový start jde novým spojením.
 * Podruhé v krátké době se už nepřenačítá — chyba propadne do záchranné
 * obrazovky (src/app/error.tsx), jinak by se aplikace točila ve smyčce.
 */
const LOAD_TIMEOUT_MS = 12_000;
const RELOADED_AT_KEY = "miligram.screenReloadedAt";
/** Za jak dlouho po přenačtení smí přijít další. */
const RELOAD_COOLDOWN_MS = 60_000;

function recentlyReloaded(): boolean {
  try {
    const at = Number(window.sessionStorage.getItem(RELOADED_AT_KEY));
    return Number.isFinite(at) && Date.now() - at < RELOAD_COOLDOWN_MS;
  } catch {
    return false;
  }
}

function markReload() {
  try {
    window.sessionStorage.setItem(RELOADED_AT_KEY, String(Date.now()));
  } catch {
    // Bez úložiště se pojistka proti smyčce ztratí; přenačíst se přesto má.
  }
}

/**
 * Přenačte aplikaci na `target` (`/?open=account`), aby člověk skončil tam,
 * kam klepl. Vrací false, když se přenačítalo před chvílí — pojistka proti
 * smyčce.
 */
export function reloadTo(target: string): boolean {
  if (recentlyReloaded()) return false;
  markReload();
  window.location.replace(target);
  return true;
}

export function guardedLoad<T>(load: () => Promise<T>, target: string): Promise<T> {
  let timer: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = window.setTimeout(() => reject(new Error("screen load timeout")), LOAD_TIMEOUT_MS);
  });

  return Promise.race([load(), timeout])
    .catch((error: unknown) => {
      if (!reloadTo(target)) throw error;
      // Stránka odchází; nic dalšího se už vykreslovat nemá.
      return new Promise<never>(() => {});
    })
    .finally(() => window.clearTimeout(timer));
}
