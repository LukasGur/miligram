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
 * Data se drží, dokud nezestárnou nebo je nezneplatní zápis:
 *
 * - **Zápis zneplatní, co změnil.** Každá funkce v src/lib/remote.ts, která
 *   na serveru něco mění, zavolá `invalidateQueries` se jmény dotazů,
 *   kterých se změna týká. Zneplatnění je tam, ne u tlačítek — dřív se
 *   `refresh()` volalo ručně z obrazovek a kde se zapomnělo, profil ukazoval
 *   „tvůj tah“ u souboje, který byl právě dohraný.
 * - **Stará data se stáhnou znovu**, když se na dotaz přihlásí obrazovka
 *   nebo se aplikace vrátí do popředí a data jsou starší než STALE_MS.
 *   Kamarád mezitím mohl výzvu přijmout.
 * - **Při obnově zůstávají vidět předchozí data**, žádné problikávání
 *   prázdné obrazovky. `loading` říká, že se obnovuje.
 *
 * Klíč dotazu má tvar `jméno:…` (např. `duels:<userId>`); zneplatňuje se
 * podle jména.
 */
type Snapshot = { status: "loading" | "ready" | "error"; data: unknown; error: unknown };

type Entry = {
  /**
   * Snímek se při každé změně nahradí novým objektem, ne přepíše.
   * `useSyncExternalStore` porovnává snímky přes Object.is — kdyby se
   * měnil obsah téhož objektu, React by změnu neviděl a obrazovka by
   * zůstala viset na „načítám“.
   */
  snapshot: Snapshot;
  listeners: Set<() => void>;
  /** Data jsou platná. False: při příštím přihlášení se stáhnou znovu. */
  fresh: boolean;
  /** Kdy naposledy dorazila data. */
  loadedAt: number;
  /**
   * Pořadí načtení. Odpověď staršího načtení, která dorazí po novějším,
   * se zahodí — jinak by pomalá stará odpověď přepsala čerstvá data.
   */
  generation: number;
  loader?: () => Promise<unknown>;
};

/** Po jaké době se data při návratu na obrazovku stáhnou znovu. */
const STALE_MS = 30_000;

const cache = new Map<string, Entry>();

function entryFor(key: string): Entry {
  let entry = cache.get(key);
  if (!entry) {
    entry = {
      snapshot: { status: "loading", data: undefined, error: undefined },
      listeners: new Set(),
      fresh: false,
      loadedAt: 0,
      generation: 0,
    };
    cache.set(key, entry);
  }
  return entry;
}

function publish(entry: Entry, snapshot: Snapshot) {
  entry.snapshot = snapshot;
  for (const listener of entry.listeners) listener();
}

function load(key: string, loader: () => Promise<unknown>) {
  const entry = entryFor(key);
  const generation = ++entry.generation;
  entry.fresh = true;
  entry.loader = loader;
  watchResume();
  publish(entry, { status: "loading", data: entry.snapshot.data, error: undefined });

  loader().then(
    (data) => {
      if (generation !== entry.generation) return;
      entry.loadedAt = Date.now();
      publish(entry, { status: "ready", data, error: undefined });
    },
    (error) => {
      if (generation !== entry.generation) return;
      // Chyba nemaže, co už bylo vidět; nový pokus přijde po návratu
      // do aplikace nebo s obnovenou sítí.
      entry.fresh = false;
      publish(entry, { status: "error", data: entry.snapshot.data, error });
    },
  );
}

function stale(entry: Entry): boolean {
  return !entry.fresh || (entry.snapshot.status === "ready" && Date.now() - entry.loadedAt > STALE_MS);
}

export type RemoteQuery<T> = {
  /** Poslední známá data, i během obnovy. */
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
      const first = entry.listeners.size === 0;
      entry.listeners.add(onChange);
      // Neplatná data (nikdy nenačtená, zneplatněná, spadlá) se stáhnou
      // vždycky. Platná, ale stará jen pro prvního odběratele — obrazovka,
      // která se otevírá; druhá komponenta na téže obrazovce nic nespouští.
      if (!entry.fresh || (first && stale(entry))) load(key, loader);
      return () => {
        entry.listeners.delete(onChange);
      };
    },
    // loader se mění při každém vykreslení rodiče; identitu dotazu nese klíč.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );

  const snapshot = useCallback(() => (key === null ? undefined : entryFor(key).snapshot), [key]);
  const state = useSyncExternalStore(subscribe, snapshot, () => undefined);

  const refresh = useCallback(() => {
    if (key !== null) load(key, loader);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return {
    data: state?.data as T | undefined,
    loading: state === undefined || state.status === "loading",
    error: state?.status === "error" ? state.error : undefined,
    refresh,
  };
}

/**
 * Zneplatní dotazy podle jména (část klíče před první dvojtečkou). Na které
 * se právě někdo dívá, ty se stáhnou hned; ostatní při příštím otevření.
 */
export function invalidateQueries(names: readonly string[]): void {
  const wanted = new Set(names);
  for (const [key, entry] of cache) {
    if (!wanted.has(key.split(":")[0])) continue;
    if (entry.listeners.size > 0 && entry.loader) load(key, entry.loader);
    else entry.fresh = false;
  }
}

/**
 * Obnova po návratu do aplikace nebo po obnovení sítě.
 *
 * iPhone aplikaci na ploše uspí; mezitím kamarád mohl přijmout výzvu
 * nebo dohrát souboj, a první dotazy po probuzení občas spadnou (v logu
 * 401 hned po obnově tokenu). Stáhnou se znovu dotazy, na které se někdo
 * dívá a jsou chybné nebo starší než STALE_MS.
 */
let watching = false;

function refreshVisible() {
  for (const [key, entry] of cache) {
    if (entry.listeners.size === 0 || !entry.loader) continue;
    if (entry.snapshot.status === "error" || stale(entry)) load(key, entry.loader);
  }
}

function watchResume() {
  if (watching || typeof window === "undefined") return;
  watching = true;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refreshVisible();
  });
  window.addEventListener("online", refreshVisible);
}

/** Zapomene uložený výsledek — po odhlášení nesmí zůstat viset cizí data. */
export function forgetRemoteQueries(): void {
  cache.clear();
}
