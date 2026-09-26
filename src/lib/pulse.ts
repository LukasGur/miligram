"use client";

import { useSyncExternalStore } from "react";

/**
 * Co domovská obrazovka ví o sociální vrstvě, aniž by sáhla na server.
 *
 * Domov nesmí stáhnout klienta Supabase (240 kB). Výměnu se serverem
 * dělá SyncAgent na pozadí a sem zapíše jen výtah: přezdívku pro monogram
 * místo ikony účtu a jestli něco čeká na uživatele — výzva, souboj
 * na tahu, žádost o přátelství nebo výsledek týdne. Z toho je tečka.
 *
 * Drží se v localStorage: je to pohodlí jednoho zařízení, ne data.
 */
export type Pulse = {
  userId: string;
  handle: string | null;
  /** Kolik věcí čeká na akci uživatele. */
  attention: number;
};

const KEY = "miligram:pulse";
const listeners = new Set<() => void>();
let cached: Pulse | null | undefined;

function read(): Pulse | null {
  if (cached !== undefined) return cached;
  try {
    const raw = window.localStorage.getItem(KEY);
    cached = raw ? (JSON.parse(raw) as Pulse) : null;
  } catch {
    cached = null;
  }
  return cached;
}

function write(next: Pulse | null) {
  cached = next;
  try {
    if (next) window.localStorage.setItem(KEY, JSON.stringify(next));
    else window.localStorage.removeItem(KEY);
  } catch {
    // Soukromé okno nebo plné úložiště: tečka se prostě neukáže.
  }
  for (const listener of listeners) listener();
}

/** Doplní výtah. Jiný účet začíná načisto. */
export function updatePulse(userId: string, patch: Partial<Omit<Pulse, "userId">>): void {
  const current = read();
  const base: Pulse = current?.userId === userId ? current : { userId, handle: null, attention: 0 };
  const next = { ...base, ...patch };
  if (current && next.handle === current.handle && next.attention === current.attention && next.userId === current.userId) return;
  write(next);
}

export function clearPulse(): void {
  write(null);
}

/**
 * Výtah pro domovskou obrazovku. Ta o přihlášení neví (klient Supabase
 * se na ni nenačítá), takže bere, co zapsal SyncAgent; po odhlášení se
 * výtah maže.
 */
export function usePulse(): Pulse | null {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    read,
    () => null,
  );
}
