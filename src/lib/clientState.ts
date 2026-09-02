"use client";

import { useSyncExternalStore } from "react";
import { readLocal, subscribeLocal } from "./localStore";
import {
  detectPlatform,
  getInstallPrompt,
  isStandalone,
  subscribeInstallPrompt,
  type Platform,
} from "./pwa";

/**
 * Prohlížečový stav (localStorage, display-mode, online) je externí zdroj dat.
 * useSyncExternalStore je pro něj správný nástroj: server dostane neutrální
 * snímek, klient po hydrataci ten skutečný — bez setState v efektu
 * a bez rizika hydratačního rozdílu.
 */
const noopSubscribe = () => () => {};

/** true až po hydrataci. Používá se tam, kde nesmí probliknout nesprávný stav. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

/**
 * Odložení lišty má omezenou platnost, takže snímek musí sáhnout na čas.
 * Funkce žije mimo tělo komponenty a vrací boolean, takže se identita
 * výsledku nemění a render zůstává čistý.
 */
const snoozeSnapshots = new Map<string, () => boolean>();

function snoozeSnapshot(key: string, durationMs: number) {
  const id = `${key}|${durationMs}`;
  let snapshot = snoozeSnapshots.get(id);
  if (!snapshot) {
    snapshot = () => {
      const raw = readLocal(key);
      if (raw === null) return false;
      const at = Number(raw);
      return Number.isFinite(at) && Date.now() - at < durationMs;
    };
    snoozeSnapshots.set(id, snapshot);
  }
  return snapshot;
}

const assumeSnoozed = () => true;

/** true, dokud platí odložení uložené pod daným klíčem. */
export function useSnoozed(key: string, durationMs: number): boolean {
  return useSyncExternalStore(subscribeLocal, snoozeSnapshot(key, durationMs), assumeSnoozed);
}

export function useLocalValue(key: string): string | null {
  return useSyncExternalStore(
    subscribeLocal,
    () => readLocal(key),
    () => null,
  );
}

const subscribeDisplayMode = (onChange: () => void) => {
  const media = window.matchMedia("(display-mode: standalone)");
  media.addEventListener("change", onChange);
  window.addEventListener("appinstalled", onChange);
  return () => {
    media.removeEventListener("change", onChange);
    window.removeEventListener("appinstalled", onChange);
  };
};

export function useStandalone(): boolean {
  return useSyncExternalStore(
    subscribeDisplayMode,
    isStandalone,
    () => false,
  );
}

let cachedPlatform: Platform | null = null;
const getPlatform = () => (cachedPlatform ??= detectPlatform());

export function usePlatform(): Platform {
  return useSyncExternalStore(
    noopSubscribe,
    getPlatform,
    () => "unknown" as Platform,
  );
}

export function useInstallPrompt() {
  return useSyncExternalStore(
    subscribeInstallPrompt,
    getInstallPrompt,
    () => null,
  );
}

const subscribeOnline = (onChange: () => void) => {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
};

export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}
