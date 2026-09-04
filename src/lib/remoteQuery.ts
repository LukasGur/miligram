"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Načítání dat ze serveru.
 *
 * Proč ne prostý `useEffect` s `setState`: React od komponent chce, aby se
 * na vnější svět *přihlašovaly*, ne aby v efektu nastavovaly stav. Rozdíl
 * není kosmetický — přihlášení dovolí sdílet jeden výsledek mezi víc
 * komponentami a znovu ho použít, když se obrazovka otevře podruhé.
 *
 * Dotaz se spustí ve chvíli, kdy se na něj přihlásí první komponenta,
 * a výsledek si drží tenhle modul.
 */
type Entry = {
  status: "loading" | "ready" | "error";
  data: unknown;
  error: unknown;
  listeners: Set<() => void>;
  started: boolean;
};

const cache = new Map<string, Entry>();

function entryFor(key: string): Entry {
  let entry = cache.get(key);
  if (!entry) {
    entry = { status: "loading", data: undefined, error: undefined, listeners: new Set(), started: false };
    cache.set(key, entry);
  }
  return entry;
}

function notify(entry: Entry) {
  for (const listener of entry.listeners) listener();
}

function load(key: string, loader: () => Promise<unknown>) {
  const entry = entryFor(key);
  entry.started = true;
  entry.status = "loading";
  notify(entry);

  loader().then(
    (data) => {
      entry.status = "ready";
      entry.data = data;
      notify(entry);
    },
    (error) => {
      entry.status = "error";
      entry.error = error;
      notify(entry);
    },
  );
}

export type RemoteQuery<T> = {
  data: T | undefined;
  loading: boolean;
  error: unknown;
  refresh: () => void;
};

/**
 * `key` určuje totožnost dotazu. Když je null, dotaz se nespustí — hodí se
 * pro obrazovky, které mají smysl až po přihlášení.
 */
export function useRemoteQuery<T>(key: string | null, loader: () => Promise<T>): RemoteQuery<T> {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (key === null) return () => {};
      const entry = entryFor(key);
      entry.listeners.add(onChange);
      // Dotaz se pouští při prvním přihlášení, ne při každém vykreslení.
      if (!entry.started) load(key, loader);
      return () => {
        entry.listeners.delete(onChange);
      };
    },
    // loader se mění při každém vykreslení rodiče; identitu dotazu nese klíč.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );

  const snapshot = useCallback(() => (key === null ? undefined : entryFor(key)), [key]);
  const entry = useSyncExternalStore(subscribe, snapshot, () => undefined);

  const refresh = useCallback(() => {
    if (key !== null) load(key, loader);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return {
    data: entry?.status === "ready" ? (entry.data as T) : undefined,
    loading: entry === undefined || entry.status === "loading",
    error: entry?.status === "error" ? entry.error : undefined,
    refresh,
  };
}

/** Zapomene uložený výsledek — po odhlášení nesmí zůstat viset cizí data. */
export function forgetRemoteQueries(): void {
  cache.clear();
}
