"use client";

import { useEffect } from "react";
import { fetchLessons, remoteGateway } from "@/lib/remote";
import { restoreOnce } from "@/lib/restore";
import { supabase } from "@/lib/supabase";
import { syncOutbox } from "@/lib/sync";
import { usePendingEvents } from "@/lib/useProfile";
import { useSession } from "@/lib/useSession";

/**
 * Výměna se serverem na pozadí: odeslání fronty a obnova historie.
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

  /**
   * Obnova po přihlášení. Čerstvá instalace nemá doma nic, ale server její
   * historii zná — bez stažení by uživatel viděl doma nulu a vedle v lize
   * svoje skutečné XP. Běží jednou na účet, značka je v profilu.
   */
  useEffect(() => {
    const client = supabase();
    if (!client || !userId) return;

    let cancelled = false;
    const pull = () => {
      if (cancelled || !navigator.onLine) return;
      void restoreOnce(userId, { pullLessons: () => fetchLessons(client, userId) }).catch(() => {});
    };

    pull();
    window.addEventListener("online", pull);
    return () => {
      cancelled = true;
      window.removeEventListener("online", pull);
    };
  }, [userId]);

  return null;
}
