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
  /**
   * Účet, jehož historie se na tohle zařízení stahovala. Po přihlášení
   * k jinému se stahuje znovu celá — historie toho druhého tu není.
   */
  restoredFor?: string;
  /**
   * Čas nejnovější stažené lekce. Další spuštění se ptá jen na to, co je
   * novější, takže běžně nepřijde nic a stahování stojí jeden dotaz.
   */
  restoredThrough?: string;
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

export type AnsweredItem = {
  templateId: string;
  seed: string;
  difficulty: number;
  correct: boolean;
  hinted: boolean;
  repaired: boolean;
};

/**
 * Rozehraná lekce.
 *
 * Jediný řádek: naráz se hraje jedna lekce. Drží pořadí odpovědí, aby se
 * dalo pokračovat tam, kde uživatel přestal. Zadání se neukládá ani tady —
 * příklad se z plánu sestaví znovu.
 */
export type LessonProgress = {
  id: number;
  lessonId: string;
  /**
   * Plán tréninku nebo opakování chyb. Denní lekce ho nemá: odvodí se celá
   * z identifikátoru, takže by uložený plán byl jen druhá kopie téhož.
   */
  plan?: unknown;
  /** Souboj, do kterého se po dokončení hlásí výsledek. */
  duelId?: string;
  answers: readonly AnsweredItem[];
  startedAt: string;
  updatedAt: string;
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
  /**
   * Identita události pro server. Pořadové číslo z Dexie se k tomu nehodí:
   * po přeinstalaci i na druhém zařízení začíná zase od jedničky, takže by
   * server druhou „událost č. 1“ zahodil jako duplicitu a lekce by se tiše
   * ztratila. Náhodné uid je jedinečné napříč zařízeními i instalacemi.
   */
  uid: string;
  type: "lessonFinished" | "pillsSpent";
  payload: Record<string, unknown>;
  createdAt: string;
  /** Doplní se po odeslání; do té doby je událost čekající. */
  syncedAt?: string;
};

/** Náhodné uid události. Fallback je pro prohlížeče bez `randomUUID`. */
export function eventUid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

class MiligramDatabase extends Dexie {
  profile!: Table<Profile, number>;
  answers!: Table<AnswerRecord, number>;
  lessons!: Table<LessonRecord, number>;
  outbox!: Table<OutboxEvent, number>;
  progress!: Table<LessonProgress, number>;

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

    /**
     * Třetí verze dává každé události vlastní uid. Události uložené starší
     * verzí se dopočítají; ty už odeslané se znovu neposílají, takže změna
     * identity nikomu nic nezdvojí.
     */
    this.version(3)
      .stores({ outbox: "++id, &uid, type, syncedAt" })
      .upgrade(async (transaction) => {
        await transaction
          .table<OutboxEvent>("outbox")
          .toCollection()
          .modify((event) => {
            event.uid ??= eventUid();
          });
      });

    /**
     * Čtvrtá verze ukládá rozehranou lekci. Bez ní se odpovědi držely jen
     * v paměti obrazovky: kdo lekci opustil v půlce, přišel o všechny
     * a dnešní cíl se po jeho práci nepohnul.
     */
    this.version(4).stores({ progress: "id" });
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
  answers: readonly AnsweredItem[];
  reward: { xp: number; pills: number; correct: number; count: number; flawless: boolean };
};

/** Jediný řádek — naráz je rozehraná nejvýš jedna lekce. */
export const PROGRESS_ID = 1;

export async function readProgress(): Promise<LessonProgress | undefined> {
  return db().progress.get(PROGRESS_ID);
}

/**
 * Zapíše jednu zodpovězenou otázku.
 *
 * Zapisuje se hned, ne až na konci lekce. Kdo vystoupí z tramvaje po třetím
 * příkladu, má tři hotové — jak v dnešním cíli, tak ve chvíli, kdy se vrátí
 * a bude chtít lekci dohrát. Dřív odpovědi žily jen v paměti obrazovky
 * a odchod je zahodil.
 *
 * XP a prášky se tu nepřipisují. Odměna patří lekci jako celku: je v ní
 * bonus za bezchybný průchod a server ji počítá z celé lekce. Rozpad
 * na jednotlivé odpovědi by se s ním rozešel.
 */
export async function recordAnswer(
  lessonId: string,
  answer: AnsweredItem,
  options: { plan?: unknown; duelId?: string } = {},
  now = new Date(),
): Promise<void> {
  const timestamp = now.toISOString();
  const database = db();

  await database.transaction("rw", database.answers, database.progress, async () => {
    const current = await database.progress.get(PROGRESS_ID);
    // Jiná lekce než rozehraná znamená, že uživatel mezitím začal jinou.
    // Odpovědi té předchozí zůstávají uložené, jen se v ní už nepokračuje.
    const running = current?.lessonId === lessonId ? current : undefined;
    const answers = [...(running?.answers ?? []), answer];

    await database.answers.add({
      lessonId,
      index: answers.length - 1,
      templateId: answer.templateId,
      seed: answer.seed,
      difficulty: answer.difficulty,
      correct: answer.correct,
      hinted: answer.hinted,
      repaired: answer.repaired,
      answeredAt: timestamp,
    });

    await database.progress.put({
      id: PROGRESS_ID,
      lessonId,
      // Plán a souboj se opisují z rozehrané lekce, když je volající
      // nepřipomene. Jinak by je druhá odpověď v pořadí umazala.
      plan: options.plan ?? running?.plan,
      duelId: options.duelId ?? running?.duelId,
      answers,
      startedAt: running?.startedAt ?? timestamp,
      updatedAt: timestamp,
    });
  });
}

/** Zahodí rozehranou lekci. Uložené odpovědi zůstávají — práce se nemaže. */
export async function clearProgress(): Promise<void> {
  await db().progress.delete(PROGRESS_ID);
}

/**
 * Zapíše dokončenou lekci. Všechno v jedné transakci: kdyby zápis skončil
 * v půlce, seděl by profil na jinou historii, než jaká je uložená.
 */
export async function recordLesson(lesson: FinishedLesson, now = new Date()): Promise<Profile> {
  const timestamp = now.toISOString();
  const today = localDay(now);
  const database = db();

  // Tabulky polem, ať se řádek vejde: přibyla mezi ně rozehraná lekce.
  const tables = [database.profile, database.answers, database.lessons, database.outbox, database.progress];

  return database.transaction("rw", tables, async () => {
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
    /**
     * Odpovědi zpravidla uložil `recordAnswer` hned po každém příkladu.
     * Zapisují se tady jen tehdy, když po lekci žádné nezůstaly — z testu
     * nebo z obnovy —, aby se nezaložily dvakrát.
     */
    const stored = await database.answers.where("lessonId").equals(lesson.lessonId).count();
    if (stored === 0) {
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
    }
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
      uid: eventUid(),
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

    // Lekce je dohraná, rozehranou už není co držet.
    await database.progress.delete(PROGRESS_ID);

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
      uid: eventUid(),
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
      uid: eventUid(),
      type: "pillsSpent",
      payload: { amount: cost, reason: "streakFreeze" },
      createdAt: timestamp,
    });
    return "ok";
  });
}
