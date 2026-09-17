"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { currentStreak } from "@/core/economy";
import { db, emptyProfile, PROFILE_ID, type Profile } from "./db";
import { answeredToday, weekActivity, type WeekDay } from "./stats";

/**
 * Profil pro zobrazení.
 *
 * `useLiveQuery` sleduje databázi, takže se čísla na úvodní obrazovce
 * přepíšou hned po dokončené lekci — bez ručního obnovování a bez toho,
 * aby stav žil na dvou místech.
 */
export function useProfile(): { profile: Profile; streak: number; ready: boolean } {
  const stored = useLiveQuery(() => db().profile.get(PROFILE_ID), []);
  const profile = stored ?? emptyProfile();

  return {
    profile,
    // Uložená série může být z předvčerejška; co se má zobrazit dnes,
    // se dopočítá při čtení, aby se kvůli tomu nemusela přepisovat databáze.
    streak: currentStreak({
      days: profile.streakDays,
      lastDay: profile.lastLessonDay,
      freezes: profile.streakFreezes ?? 0,
    }),
    ready: stored !== undefined,
  };
}

/** Kolik událostí čeká na odeslání. Nula znamená, že server ví všechno. */
export function usePendingEvents(): number {
  return useLiveQuery(
    () => db().outbox.filter((event) => event.syncedAt === undefined && event.type === "lessonFinished").count(),
    [],
    0,
  );
}

/**
 * Dnešní postup a týden pozadu. Obojí se přepočítá samo, jakmile doběhne
 * zápis lekce — proto `useLiveQuery` a ne jednorázové načtení.
 */
export function useToday(): { answered: number; week: WeekDay[] } {
  const answered = useLiveQuery(() => answeredToday(), [], 0);
  const week = useLiveQuery(() => weekActivity(), [], []);
  return { answered, week };
}
