"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { localDay, REPAIR_COST, repairOffer, type RepairOffer } from "@/core/economy";
import { db, emptyProfile, eventUid, PROFILE_ID, type WalletPayload } from "./db";
import { rebuildStreak } from "./restore";

/**
 * Obnovení spadlé série.
 *
 * Vynechané dny se zapíšou jako pokryté — stejně jako den, který podržela
 * ochrana — a série se složí znovu z historie. Díky tomu platí obě situace
 * naráz: když student ještě nehrál, série „dojede“ ke včerejšku; když už
 * zase hrál a začal od jedničky, stará řada se s novou spojí.
 *
 * Na server jde pohyb za každý pokrytý den; cenu nese první. Server
 * obnovení hlídá i sám (migrace 0015): série je veřejná.
 */
export async function repairStreak(offer: RepairOffer, now = new Date()): Promise<"ok" | "poor"> {
  const timestamp = now.toISOString();
  const database = db();

  const result = await database.transaction("rw", database.profile, database.outbox, async () => {
    const current = (await database.profile.get(PROFILE_ID)) ?? emptyProfile(now);
    if (current.pills < REPAIR_COST) return "poor" as const;

    await database.profile.put({
      ...current,
      pills: current.pills - REPAIR_COST,
      coveredDays: [...new Set([...(current.coveredDays ?? []), ...offer.missing])].sort(),
      lastRepair: localDay(now),
      updatedAt: timestamp,
    });
    for (const [index, day] of offer.missing.entries()) {
      const payload: WalletPayload = {
        kind: "repair",
        pills: index === 0 ? -REPAIR_COST : 0,
        freezes: 0,
        reason: "streakRepair",
        day,
      };
      // Pořadí ve frontě drží pořadové číslo: placený den jde první.
      await database.outbox.add({ uid: `repair:${day}:${eventUid()}`, type: "wallet", payload, createdAt: timestamp });
    }
    return "ok" as const;
  });

  if (result === "ok") await rebuildStreak();
  return result;
}

/**
 * Nabídka obnovení pro domovskou obrazovku. Počítá se z uložených lekcí,
 * takže zmizí sama, jakmile se série obnoví nebo lhůta uplyne.
 */
export function useRepairOffer(): RepairOffer | null | undefined {
  return useLiveQuery(async () => {
    const database = db();
    const [lessons, profile] = await Promise.all([database.lessons.toArray(), database.profile.get(PROFILE_ID)]);
    if (!profile) return null;
    return repairOffer({
      lessonDays: lessons.map((lesson) => localDay(new Date(lesson.finishedAt))),
      coveredDays: profile.coveredDays ?? [],
      freezes: profile.streakFreezes ?? 0,
      lastRepair: profile.lastRepair ?? null,
    });
  }, []);
}
