"use client";

import { useEffect } from "react";
import { MAX_STREAK_FREEZES } from "@/core/economy";
import { useLocale } from "@/i18n/LocaleProvider";
import { claimGift as markClaimed, fetchLessons, pendingGifts, remoteGateway } from "@/lib/remote";
import { claimGift } from "@/lib/db";
import { pullNews } from "@/lib/restore";
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
 * nebylo.
 */
export function SyncAgent() {
  const { session } = useSession();
  const { locale } = useLocale();
  const pending = usePendingEvents();
  const userId = session?.user.id;
  const accountLocale: unknown = session?.user.user_metadata?.locale;

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
   * Stažení toho, co zařízení nezná. Čerstvá instalace nemá doma nic, ale
   * server historii zná — bez stažení by uživatel viděl doma nulu a vedle
   * v lize svoje skutečné XP. Podruhé a dál se ptá jen na novinky, takže
   * se doženou i dvě zařízení téhož uživatele.
   */
  useEffect(() => {
    const client = supabase();
    if (!client || !userId) return;

    let cancelled = false;
    const pull = () => {
      if (cancelled || !navigator.onLine) return;
      void pullNews(userId, { pullLessons: (since) => fetchLessons(client, userId, since) }).catch(() => {});
    };

    pull();
    window.addEventListener("online", pull);
    return () => {
      cancelled = true;
      window.removeEventListener("online", pull);
    };
  }, [userId]);

  /**
   * Vyzvednutí darů od kamarádů. Ochrana se připíše do zásob na zařízení
   * a teprve pak se dar na serveru označí za vyzvednutý — kdyby se to
   * obrátilo, výpadek uprostřed by dar spolkl. Připsání je idempotentní
   * podle identifikátoru, takže opakování nikomu nic nezdvojí.
   */
  useEffect(() => {
    const client = supabase();
    if (!client || !userId) return;

    let cancelled = false;
    const collect = async () => {
      if (cancelled || !navigator.onLine) return;
      for (const gift of await pendingGifts(client, userId)) {
        if (cancelled) return;
        const result = await claimGift(gift, MAX_STREAK_FREEZES);
        // Plná zásoba: dar počká, až bude místo.
        if (result === "full") return;
        await markClaimed(client, gift.id);
      }
    };

    const retry = () => void collect().catch(() => {});
    retry();
    window.addEventListener("online", retry);
    return () => {
      cancelled = true;
      window.removeEventListener("online", retry);
    };
  }, [userId]);

  /**
   * Jazyk přihlašovacích e-mailů. Šablona v Supabase vybírá češtinu nebo
   * slovenštinu podle `locale` v metadatech účtu (scripts/supabase/auth-emails.mjs).
   * Při založení účtu ho zapíše přihlášení; tady se srovná po přihlášení
   * na jiném zařízení a po přepnutí jazyka, aby další kód přišel tak,
   * jak má uživatel aplikaci nastavenou.
   */
  useEffect(() => {
    const client = supabase();
    if (!client || !userId || accountLocale === locale) return;

    let cancelled = false;
    const save = () => {
      if (cancelled || !navigator.onLine) return;
      void client.auth.updateUser({ data: { locale } }).catch(() => {});
    };

    save();
    window.addEventListener("online", save);
    return () => {
      cancelled = true;
      window.removeEventListener("online", save);
    };
  }, [userId, accountLocale, locale]);

  return null;
}
