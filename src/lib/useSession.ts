"use client";

import { useSyncExternalStore } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { forgetRemoteQueries } from "./remoteQuery";
import { clearPulse } from "./pulse";

/**
 * Přihlášení jako vnější úložiště.
 *
 * Supabase si sezení drží samo a hlásí změny zpětným voláním — přesně to,
 * na co je `useSyncExternalStore`. Komponenty se tak jen přihlásí k odběru
 * a nikdo nemusí stav zrcadlit do `useState`.
 */
type SessionState = { session: Session | null; ready: boolean };

let state: SessionState = { session: null, ready: false };
const listeners = new Set<() => void>();
let started = false;

function publish(next: SessionState) {
  state = next;
  for (const listener of listeners) listener();
}

function start() {
  const client = supabase();
  if (!client) {
    // Bez nastaveného serveru je odpověď známá hned: nikdo přihlášený není.
    publish({ session: null, ready: true });
    return;
  }

  void client.auth.getSession().then(({ data }) => publish({ session: data.session, ready: true }));

  client.auth.onAuthStateChange((_event, session) => {
    // Po odhlášení nesmí na obrazovce zůstat data předchozího účtu.
    if (session === null) {
      forgetRemoteQueries();
      clearPulse();
    }
    publish({ session, ready: true });
  });
}

const SERVER_STATE: SessionState = { session: null, ready: false };

export function useSession(): SessionState {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      if (!started) {
        started = true;
        start();
      }
      return () => listeners.delete(onChange);
    },
    () => state,
    () => SERVER_STATE,
  );
}
