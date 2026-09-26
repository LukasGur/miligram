"use client";

import { useSyncExternalStore } from "react";
import { isTone } from "@/core/monogram";

/**
 * Vybrané tóny monogramů, podle přezdívky.
 *
 * Monogram je na dvanácti místech a všude zná jen přezdívku. Místo aby se
 * tón protahoval každým seznamem, zapíše ho sem každý dotaz, který čte
 * profily (src/lib/remote.ts), a monogram si ho tu najde. Kdo tón nemá
 * (nevybral si, nebo se ještě nenačetl), má ten z přezdívky.
 *
 * Drží se v localStorage, aby hlavička domovské obrazovky měla správnou
 * barvu i bez sítě a bez klienta Supabase. Je to pohodlí, ne data.
 */
const KEY = "miligram:tones";
const listeners = new Set<() => void>();
let cached: Readonly<Record<string, number>> | undefined;

function read(): Readonly<Record<string, number>> {
  if (cached !== undefined) return cached;
  try {
    const raw = window.localStorage.getItem(KEY);
    cached = raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    cached = {};
  }
  return cached;
}

/** Zapamatuje tóny z načtených profilů. Prázdný tón vybraný zruší. */
export function rememberTones(rows: readonly { handle: string; tone?: number | null }[]): void {
  const current = read();
  let next: Record<string, number> | null = null;
  for (const { handle, tone } of rows) {
    if (!handle) continue;
    const key = handle.toLowerCase();
    const value = isTone(tone) ? tone : undefined;
    if (current[key] === value) continue;
    next ??= { ...current };
    if (value === undefined) delete next[key];
    else next[key] = value;
  }
  if (next === null) return;
  cached = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Soukromé okno: tón vydrží do zavření aplikace.
  }
  for (const listener of listeners) listener();
}

export function clearTones(): void {
  cached = {};
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nic k úklidu.
  }
  for (const listener of listeners) listener();
}

const EMPTY: Readonly<Record<string, number>> = {};

/** Vybraný tón přezdívky, nebo undefined. */
export function useChosenTone(handle: string): number | undefined {
  const tones = useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    read,
    () => EMPTY,
  );
  return tones[handle.toLowerCase()];
}
