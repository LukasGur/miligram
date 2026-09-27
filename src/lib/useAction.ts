"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Jak dlouho smí akce trvat, než ji obrazovka vzdá.
 *
 * Síťový požadavek má vlastní limit (src/lib/supabase.ts), ale akce může
 * uvíznout i jinde — před odesláním, v přihlašovací vrstvě, po probuzení
 * aplikace na iPhonu. Tenhle limit hlídá celek: ať se zasekne cokoli,
 * tlačítko se uvolní a řekne „zkus to znovu“ místo toho, aby mlčelo.
 */
export const ACTION_TIMEOUT_MS = 20_000;

export class ActionTimeoutError extends Error {
  constructor() {
    super("Akce nedoběhla včas.");
  }
}

export function withTimeout<T>(promise: Promise<T>, ms = ACTION_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new ActionTimeoutError()), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export type Action = {
  busy: boolean;
  /** Akce spadla nebo nedoběhla. Obrazovka ukáže „zkus to znovu“. */
  failed: boolean;
  /**
   * Spustí akci. Druhé klepnutí, než první doběhne, se zahodí. Chyba
   * se nevyhazuje dál: vrací se undefined a `failed` je true — tichá
   * chyba, po které tlačítko jen přestane reagovat, se nesmí stát.
   */
  run: <T>(action: () => Promise<T>) => Promise<T | undefined>;
  reset: () => void;
};

/** Akce, která mluví se serverem: stav odesílání, časový limit, chyba. */
export function useAction(): Action {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const running = useRef(false);

  const run = useCallback(async <T,>(action: () => Promise<T>): Promise<T | undefined> => {
    if (running.current) return undefined;
    running.current = true;
    setBusy(true);
    setFailed(false);
    try {
      return await withTimeout(action());
    } catch {
      setFailed(true);
      return undefined;
    } finally {
      running.current = false;
      setBusy(false);
    }
  }, []);

  const reset = useCallback(() => setFailed(false), []);
  return { busy, failed, run, reset };
}
