"use client";

import { useSyncExternalStore } from "react";

/**
 * Oznámení o připsaném bonusu za registraci.
 *
 * Bonus připisuje synchronizace na pozadí (SyncAgent), ukazuje ho
 * AccountGate. Mezi nimi stačí tahle schránka: jedno číslo, dokud si ho
 * někdo nepřečte. Nic se neukládá — kdo aplikaci zavře dřív, než se
 * oznámení ukáže, má pastilky stejně v zůstatku.
 */
let amount: number | null = null;
const listeners = new Set<() => void>();

function publish(next: number | null) {
  amount = next;
  for (const listener of listeners) listener();
}

export function announceBonus(value: number): void {
  publish(value);
}

export function dismissBonus(): void {
  publish(null);
}

export function useBonus(): number | null {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    () => amount,
    () => null,
  );
}
