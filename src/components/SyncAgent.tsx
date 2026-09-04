"use client";

import { useEffect } from "react";
import { remoteGateway } from "@/lib/remote";
import { supabase } from "@/lib/supabase";
import { syncOutbox } from "@/lib/sync";
import { usePendingEvents } from "@/lib/useProfile";
import { useSession } from "@/lib/useSession";

/**
 * Odesílání fronty na pozadí.
 *
 * Nic nevykresluje. Spustí se, když je co poslat a je komu — tedy po
 * dokončené lekci, po přihlášení a ve chvíli, kdy se vrátí síť.
 *
 * Chyby se tady zamlčují schválně. Fronta zůstane nedotčená a zkusí se
 * znovu; hlásit výpadek sítě uprostřed jiné práce by uživateli k ničemu
 * nebylo. Kdo chce vědět, kolik čeká, najde to na obrazovce účtu.
 */
export function SyncAgent() {
  const { session } = useSession();
  const pending = usePendingEvents();
  const userId = session?.user.id;

  useEffect(() => {
    const client = supabase();
    if (!client || !userId || pending === 0) return;

    let cancelled = false;
    const flush = () => {
      if (cancelled || !navigator.onLine) return;
      void syncOutbox(remoteGateway(client, userId)).catch(() => {});
    };

    flush();
    window.addEventListener("online", flush);
    return () => {
      cancelled = true;
      window.removeEventListener("online", flush);
    };
  }, [userId, pending]);

  return null;
}
