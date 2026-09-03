"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { currentStreak } from "@/core/economy";
import { db, emptyProfile, PROFILE_ID, type Profile } from "./db";

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
    streak: currentStreak({ days: profile.streakDays, lastDay: profile.lastLessonDay }),
    ready: stored !== undefined,
  };
}
