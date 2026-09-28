"use client";

import { useEffect } from "react";
import { MAX_STREAK_FREEZES } from "@/core/economy";
import { useLocale } from "@/i18n/LocaleProvider";
import {
  claimGift as markClaimed,
  fetchLessons,
  fetchProfile,
  claimSignupBonus,
  fetchWallet,
  leagueHistory,
  listDuels,
  pendingGifts,
  pendingRequests,
  remoteGateway,
  weekStart,
} from "@/lib/remote";
import { updatePulse } from "@/lib/pulse";
import { fetchQuery } from "@/lib/remoteQuery";
import { collectDuelRewards, duelsNeedingMe, flushDuelResults, publishBadgesIfChanged } from "@/lib/social";
import { unseenWeek } from "@/components/social/WeekResult";
import { SIGNUP_BONUS } from "@/core/economy";
import { announceBonus } from "@/lib/bonus";
import { claimGift, markBonusChecked, readProfile } from "@/lib/db";
import { pushOnFor, restorePushDevice, savePrefs, timeZone, usePushStatus } from "@/lib/push";
import { pullNews } from "@/lib/restore";
import { supabase } from "@/lib/supabase";
import { syncOutbox } from "@/lib/sync";
import { streakFacts, usePendingEvents, useProfile } from "@/lib/useProfile";
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
  const { profile } = useProfile();
  /**
   * Se serverem se mluví jen za účet, kterému data v telefonu patří. Dokud
   * o tom po přihlášení nerozhodne AccountGate, fronta čeká — jinak by
   * lekce odehrané bez účtu odešly k účtu, který je nechce.
   */
  const userId = session && profile.ownerId === session.user.id ? session.user.id : undefined;
  const accountLocale: unknown = session?.user.user_metadata?.locale;
  const pushStatus = usePushStatus();
  const pushOn = pushOnFor(pushStatus, userId);
  // Den, kam série sahá, ne jen poslední lekce — po obnovení je to včerejšek.
  const { streakDays, streakFreezes, lastLessonDay } = streakFacts(profile);

  useEffect(() => {
    const client = supabase();
    if (!client || !userId || pending === 0) return;

    let cancelled = false;
    const flush = () => {
      if (cancelled || !navigator.onLine) return;
      void serial(() => syncOutbox(remoteGateway(client, userId))).catch(() => {});
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
      void serial(async () => {
        /**
         * Bonus za registraci dřív, než se stáhne zůstatek — jinak by
         * se v něm ukázal až při dalším spuštění. Server ho připíše jednou
         * na účet; zařízení se zeptá jednou za dobu, co mu data patří.
         */
        if (!(await readProfile()).bonusChecked) {
          const granted = await claimSignupBonus(client);
          await markBonusChecked();
          if (granted) announceBonus(SIGNUP_BONUS);
        }
        return pullNews(userId, {
          pullLessons: (since) => fetchLessons(client, userId, since),
          pullWallet: () => fetchWallet(client),
        });
      }).catch(() => {});
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
   * Sociální vrstva pro domovskou obrazovku: přezdívka na monogram a kolik
   * věcí čeká na uživatele. K tomu připsání výher ze soubojů a odeslání
   * výsledku souboje, který se dohrál bez sítě. Ptá se po přihlášení,
   * po návratu sítě a po návratu do aplikace.
   */
  useEffect(() => {
    const client = supabase();
    if (!client || !userId) return;

    let cancelled = false;
    let running = false;
    const refresh = async () => {
      if (cancelled || running || !navigator.onLine || document.visibilityState !== "visible") return;
      running = true;
      try {
        await flushDuelResults(client, userId);
        // Stejné klíče jako obrazovky (components/social/data.ts): co už je
        // v mezipaměti čerstvé, se znovu nestahuje.
        const key = (name: string) => `${name}:${userId}`;
        const [profile, duels, requests, history] = await Promise.all([
          fetchQuery(key("profile"), () => fetchProfile(client, userId)),
          fetchQuery(key("duels"), () => listDuels(client, userId)),
          fetchQuery(key("requests"), () => pendingRequests(client, userId)),
          fetchQuery(key("leagueHistory"), () => leagueHistory(client)),
        ]);
        if (cancelled) return;
        await collectDuelRewards(userId, duels);
        // Odznak ze shrnutí lekce se tak kamarádům ukáže i bez otevření profilu.
        await publishBadgesIfChanged(client, userId).catch(() => {});
        const week = unseenWeek(history, weekStart(), userId) ? 1 : 0;
        updatePulse(userId, {
          handle: profile?.handle ?? null,
          attention: duelsNeedingMe(duels) + requests.length + week,
        });
      } finally {
        running = false;
      }
    };

    const retry = () => void refresh().catch(() => {});
    retry();
    window.addEventListener("online", retry);
    document.addEventListener("visibilitychange", retry);
    return () => {
      cancelled = true;
      window.removeEventListener("online", retry);
      document.removeEventListener("visibilitychange", retry);
    };
  }, [userId, pending]);

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

  /**
   * Odběr notifikací tohoto zařízení. Push služba ho občas vymění a po
   * odhlášení se od účtu odpojí; kdo je zapnul, dostane ho zpátky sám.
   */
  useEffect(() => {
    const client = supabase();
    if (!client || !userId) return;
    void restorePushDevice(client, userId).catch(() => {});
  }, [userId]);

  /**
   * Co server potřebuje do textů notifikací: jazyk a sérii, jak ji vidí
   * telefon (ochrany série server nezná). Srovná se po každé lekci, po
   * přepnutí jazyka a po návratu sítě.
   */
  useEffect(() => {
    const client = supabase();
    if (!client || !userId || !pushOn) return;

    // Zapisuje se jen změna. Dřív šel zápis při každém spuštění a návratu
    // domů (v logu 32× za den) se stejnými hodnotami.
    const facts = { locale, streakDays, streakFreezes, lastLessonDay };
    const fingerprint = JSON.stringify({ userId, zone: timeZone(), ...facts });
    let cancelled = false;
    const save = () => {
      if (cancelled || !navigator.onLine || readSynced() === fingerprint) return;
      void savePrefs(client, userId, facts)
        .then(() => writeSynced(fingerprint))
        .catch(() => {});
    };

    save();
    window.addEventListener("online", save);
    return () => {
      cancelled = true;
      window.removeEventListener("online", save);
    };
  }, [userId, pushOn, locale, streakDays, streakFreezes, lastLessonDay]);

  return null;
}

/**
 * Odeslání fronty a stažení novinek jdou za sebou, ne naráz. Zůstatek
 * se počítá jako „co zná server + co čeká ve frontě“; kdyby se pohyb
 * odeslal zrovna mezi dotazem na server a sečtením fronty, chyběl by
 * v obou a pastilky by na chvíli ubyly.
 */
let queue: Promise<unknown> = Promise.resolve();

function serial<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => {});
  return run;
}

const PREFS_SYNCED_KEY = "miligram:prefsSynced";

function readSynced(): string | null {
  try {
    return window.localStorage.getItem(PREFS_SYNCED_KEY);
  } catch {
    return null;
  }
}

function writeSynced(value: string): void {
  try {
    window.localStorage.setItem(PREFS_SYNCED_KEY, value);
  } catch {
    // Bez úložiště se zapíše i příště; nic horšího se nestane.
  }
}
