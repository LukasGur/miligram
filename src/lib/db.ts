import Dexie, { type Table } from "dexie";
import { advanceStreak, localDay, type StreakState } from "@/core/economy";

/**
 * Lokální databáze.
 *
 * Zdrojem pravdy pro hraní je zařízení, ne server. Aplikace musí fungovat
 * offline a bez účtu; synchronizace ve fázi 5 bude nad tímhle stavem
 * nadstavba, ne podmínka.
 *
 * Zadání příkladů se neukládá. Příklad je jednoznačně určený trojicí
 * (šablona, semínko, obtížnost), takže záznam odpovědi je pár desítek
 * bajtů a dá se z něj příklad kdykoli sestavit znovu.
 */

/** Jediný řádek — profil je singleton, aby se nedal omylem rozmnožit. */
export const PROFILE_ID = 1;

export type Profile = {
  id: number;
  pills: number;
  xp: number;
  streakDays: number;
  /** Den poslední dokončené lekce, YYYY-MM-DD v místním čase. */
  lastLessonDay: string | null;
  /** Koupené ochrany série. Uplatní se samy, když uživatel den vynechá. */
  streakFreezes: number;
  createdAt: string;
  updatedAt: string;
};

export type AnswerRecord = {
  id?: number;
  lessonId: string;
  index: number;
  templateId: string;
  seed: string;
  difficulty: number;
  correct: boolean;
  /** Zda si uživatel u příkladu koupil nápovědu. */
  hinted: boolean;
  /** Zda si koupil druhý pokus. */
  repaired: boolean;
  answeredAt: string;
};

export type LessonRecord = {
  id?: number;
  lessonId: string;
  count: number;
  correct: number;
  flawless: boolean;
  xp: number;
  pills: number;
  finishedAt: string;
};

/**
 * Fronta událostí pro synchronizaci.
 *
 * Posílá se, co se stalo, ne jaký je stav. Dvě zařízení offline nemůžou
 * poslat „mám 340 prášků“ — přepsala by se navzájem. Můžou ale obě poslat
 * „dokončil lekci abc v 14:03“ a server to složí dohromady.
 */
export type OutboxEvent = {
  id?: number;
  type: "lessonFinished" | "pillsSpent";
  payload: Record<string, unknown>;
  createdAt: string;
  /** Doplní se po odeslání; do té doby je událost čekající. */
  syncedAt?: string;
};

class MiligramDatabase extends Dexie {
  profile!: Table<Profile, number>;
  answers!: Table<AnswerRecord, number>;
  lessons!: Table<LessonRecord, number>;
  outbox!: Table<OutboxEvent, number>;

  constructor() {
    super("miligram");
    this.version(1).stores({
      profile: "id",
      answers: "++id, lessonId, templateId, correct, answeredAt",
      lessons: "++id, lessonId, finishedAt",
      outbox: "++id, type, syncedAt",
    });

    /**
     * Druhá verze přidává ochrany série. Indexy se nemění, ale profil
     * uložený první verzí to pole nemá — bez doplnění by z něj vyšlo
     * undefined a série by se chovala nepředvídatelně.
     */
    this.version(2).upgrade(async (transaction) => {
      await transaction
        .table<Profile>("profile")
        .toCollection()
        .modify((profile) => {
          profile.streakFreezes ??= 0;
        });
    });
  }
}

let instance: MiligramDatabase | null = null;

/**
 * Databáze se otevírá až při prvním použití. Modul se totiž načte i při
 * statickém exportu v Node, kde žádné IndexedDB není.
 */
export function db(): MiligramDatabase {
  instance ??= new MiligramDatabase();
  return instance;
}

export function emptyProfile(now = new Date()): Profile {
  const timestamp = now.toISOString();
  return {
    id: PROFILE_ID,
    pills: 0,
    xp: 0,
    streakDays: 0,
    lastLessonDay: null,
    streakFreezes: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export async function readProfile(): Promise<Profile> {
  return (await db().profile.get(PROFILE_ID)) ?? emptyProfile();
}

export type FinishedLesson = {
  lessonId: string;
  /** Odpovědi v pořadí, v jakém se příklady zobrazily. */
  answers: readonly {
    templateId: string;
    seed: string;
    difficulty: number;
    correct: boolean;
    hinted: boolean;
    repaired: boolean;
  }[];
  reward: { xp: number; pills: number; correct: number; count: number; flawless: boolean };
};

/**
 * Zapíše dokončenou lekci. Všechno v jedné transakci: kdyby zápis skončil
 * v půlce, seděl by profil na jinou historii, než jaká je uložená.
 */
export async function recordLesson(lesson: FinishedLesson, now = new Date()): Promise<Profile> {
  const timestamp = now.toISOString();
  const today = localDay(now);
  const database = db();

  return database.transaction("rw", database.profile, database.answers, database.lessons, database.outbox, async () => {
    const current = (await database.profile.get(PROFILE_ID)) ?? emptyProfile(now);
    const streak: StreakState = advanceStreak(
      { days: current.streakDays, lastDay: current.lastLessonDay, freezes: current.streakFreezes ?? 0 },
      today,
    );

    const updated: Profile = {
      ...current,
      pills: current.pills + lesson.reward.pills,
      xp: current.xp + lesson.reward.xp,
      streakDays: streak.days,
      lastLessonDay: streak.lastDay,
      streakFreezes: streak.freezes,
      updatedAt: timestamp,
    };

    await database.profile.put(updated);
    await database.answers.bulkAdd(
      lesson.answers.map((answer, index) => ({
        lessonId: lesson.lessonId,
        index,
        templateId: answer.templateId,
        seed: answer.seed,
        difficulty: answer.difficulty,
        correct: answer.correct,
        hinted: answer.hinted,
        repaired: answer.repaired,
        answeredAt: timestamp,
      })),
    );
    await database.lessons.add({
      lessonId: lesson.lessonId,
      count: lesson.reward.count,
      correct: lesson.reward.correct,
      flawless: lesson.reward.flawless,
      xp: lesson.reward.xp,
      pills: lesson.reward.pills,
      finishedAt: timestamp,
    });
    await database.outbox.add({
      type: "lessonFinished",
      payload: {
        lessonId: lesson.lessonId,
        answers: lesson.answers.map((answer) => ({
          templateId: answer.templateId,
          seed: answer.seed,
          difficulty: answer.difficulty,
          correct: answer.correct,
          hinted: answer.hinted,
          repaired: answer.repaired,
        })),
      },
      createdAt: timestamp,
    });

    return updated;
  });
}

/**
 * Utratí prášky. Vrací false, když na útratu nezbývá — kontrola musí být
 * uvnitř transakce, jinak by dvě rychlá klepnutí utratila totéž dvakrát.
 */
export async function spendPills(amount: number, reason: string, now = new Date()): Promise<boolean> {
  if (amount <= 0) throw new Error("Utratit se dá jen kladný počet prášků.");
  const timestamp = now.toISOString();
  const database = db();

  return database.transaction("rw", database.profile, database.outbox, async () => {
    const current = (await database.profile.get(PROFILE_ID)) ?? emptyProfile(now);
    if (current.pills < amount) return false;

    await database.profile.put({ ...current, pills: current.pills - amount, updatedAt: timestamp });
    await database.outbox.add({
      type: "pillsSpent",
      payload: { amount, reason },
      createdAt: timestamp,
    });
    return true;
  });
}

/**
 * Koupí ochranu série. Vrací false, když na ni nezbývá nebo když má
 * uživatel plný počet — víc než pár ochran naráz by ze série udělalo
 * předplatné, ne záznam o docházce.
 */
export async function buyStreakFreeze(
  cost: number,
  max: number,
  now = new Date(),
): Promise<"ok" | "poor" | "full"> {
  const timestamp = now.toISOString();
  const database = db();

  return database.transaction("rw", database.profile, database.outbox, async () => {
    const current = (await database.profile.get(PROFILE_ID)) ?? emptyProfile(now);
    if ((current.streakFreezes ?? 0) >= max) return "full";
    if (current.pills < cost) return "poor";

    await database.profile.put({
      ...current,
      pills: current.pills - cost,
      streakFreezes: (current.streakFreezes ?? 0) + 1,
      updatedAt: timestamp,
    });
    await database.outbox.add({
      type: "pillsSpent",
      payload: { amount: cost, reason: "streakFreeze" },
      createdAt: timestamp,
    });
    return "ok";
  });
}
