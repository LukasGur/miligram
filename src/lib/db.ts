import Dexie, { type Table } from "dexie";
import type { StageId } from "@/core/curriculum";
import { PILLS_PER_CORRECT, advanceStreak, localDay, type StreakState } from "@/core/economy";
import type { LessonPlan } from "@/core/lessonPlan";
import type { LessonKind } from "@/core/scoring";

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

/**
 * Jeden příklad z lekce, ne jeden pokus.
 *
 * Chybný příklad se v lekci vrací, dokud ho student nespočítá, takže
 * pokusů může být víc. Záznam je jeden a drží obojí: `correct` říká, jestli
 * se to nakonec povedlo — z toho se plní denní cíl —, a `firstTry`, jestli
 * to sedlo napoprvé. Odměna se počítá z `firstTry`, aby se XP nedalo
 * nasbírat opakováním.
 */
export type AnswerRecord = {
  id?: number;
  lessonId: string;
  index: number;
  templateId: string;
  seed: string;
  difficulty: number;
  /** Vyřešeno, byť napodruhé. */
  correct: boolean;
  /** Správně hned napoprvé. Z tohohle je XP a pastilky. */
  firstTry: boolean;
  /**
   * Pastilky za tenhle příklad už jsou v profilu. Připisují se hned po
   * odpovědi; dokončení lekce pak přidá jen zbytek, tedy bonus. Odpovědi
   * zapsané dřív, než se začalo připisovat hned, pole nemají — ty se
   * doplatí s lekcí jako dřív.
   */
  credited?: boolean;
  /** Kolikrát si na příklad student sáhl. */
  attempts: number;
  /** Zda si uživatel u příkladu koupil nápovědu. */
  hinted: boolean;
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
   * Plán lekce. Nese ho každá osobní lekce — denní podle programu, trénink
   * kategorie i opakování chyb —, protože závisí na stavu uživatele a z
   * identifikátoru se sestavit nedá. Sdílená lekce (souboj) ho nemá.
   */
  plan?: LessonPlan;
  /** Stupeň programu, ze kterého lekce je. Kvůli titulku po návratu. */
  stageId?: StageId;
  /** Souboj, do kterého se po dokončení hlásí výsledek. */
  duelId?: string;
  /**
   * Pokusy v pořadí, v jakém padly — i ty chybné. Z nich se po návratu
   * dopočítá, co předložit dál, takže se pořadí nedrží nikde jinde.
   */
  attempts: readonly LessonAttempt[];
  startedAt: string;
  updatedAt: string;
};

/**
 * Dar, který si zařízení vyzvedlo.
 *
 * Drží se lokálně ze dvou důvodů: aby se tentýž dar nepřipsal dvakrát,
 * když se zápis na server nepovede, a aby šlo na obrazovce účtu ukázat,
 * od koho ochrana přišla, bez dalšího dotazu.
 */
export type ReceivedGiftRecord = {
  /** Identifikátor daru ze serveru. */
  id: string;
  fromHandle: string;
  receivedAt: string;
};

export type LessonAttempt = {
  templateId: string;
  seed: string;
  difficulty: number;
  /** Index příkladu v plánu lekce. */
  index: number;
  correct: boolean;
  hinted: boolean;
  /** Student si po druhé chybě nechal ukázat postup a šel dál. */
  gaveUp?: boolean;
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
  gifts!: Table<ReceivedGiftRecord, string>;

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

    /**
     * Pátá verze rozlišuje „vyřešeno“ a „správně napoprvé“. Chybný příklad
     * se nově v lekci vrací, takže jeden příklad může mít víc pokusů;
     * starším záznamům obojí splývá, což odpovídá tomu, jak vznikly.
     * Rozehraná lekce zároveň přechází z hotových odpovědí na pokusy.
     */
    this.version(5).upgrade(async (transaction) => {
      await transaction
        .table<AnswerRecord>("answers")
        .toCollection()
        .modify((answer) => {
          answer.firstTry ??= answer.correct;
          answer.attempts ??= 1;
        });

      await transaction
        .table("progress")
        .toCollection()
        .modify((progress: LessonProgress & { answers?: readonly AnsweredItem[] }) => {
          if (progress.attempts !== undefined) return;
          progress.attempts = (progress.answers ?? []).map((answer, index) => ({
            templateId: answer.templateId,
            seed: answer.seed,
            difficulty: answer.difficulty,
            index,
            correct: answer.correct,
            hinted: answer.hinted,
          }));
          delete progress.answers;
        });
    });

    /** Šestá verze si pamatuje vyzvednuté dary, ať se nepřipíšou dvakrát. */
    this.version(6).stores({ gifts: "id, receivedAt" });
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
  /** Opakování chyb jde na server označené — bez toho by mu přičetl bonus. */
  kind?: LessonKind;
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
 * Pastilky za správný první pokus se připisují tady, hned. Zůstatek
 * v lekci se tak hýbe a „+2“ u odpovědi je pravda, ne slib na konec.
 * Kdo lekci nedohraje, co vydělal, má. XP se naopak připisuje až s celou
 * lekcí: server ho počítá z lekce a rozpad na odpovědi by se s ním rozešel.
 */
export async function recordAnswer(
  lessonId: string,
  attempt: LessonAttempt,
  options: { plan?: LessonPlan; stageId?: StageId; duelId?: string } = {},
  now = new Date(),
): Promise<void> {
  const timestamp = now.toISOString();
  const database = db();

  await database.transaction("rw", database.answers, database.progress, database.profile, async () => {
    const current = await database.progress.get(PROGRESS_ID);
    // Jiná lekce než rozehraná znamená, že uživatel mezitím začal jinou.
    // Pokusy té předchozí zůstávají uložené, jen se v ní už nepokračuje.
    const running = current?.lessonId === lessonId ? current : undefined;
    const attempts = [...(running?.attempts ?? []), attempt];

    /**
     * Záznam je jeden na příklad, ne na pokus. Druhý pokus tedy původní
     * záznam doplní: přibude pokus a `correct` se překlopí, jakmile se to
     * povede. `firstTry` zůstává, jak dopadl první pokus — z něj je odměna.
     */
    const stored = await database.answers.where("lessonId").equals(lessonId).toArray();
    const existing = stored.find((answer) => answer.seed === attempt.seed);

    if (existing?.id === undefined) {
      // Odměna je jen za první pokus: opakování ani vzdání nic nepřipíše.
      const earned = attempt.correct && !attempt.gaveUp;
      if (earned) {
        const profile = (await database.profile.get(PROFILE_ID)) ?? emptyProfile(now);
        await database.profile.put({ ...profile, pills: profile.pills + PILLS_PER_CORRECT, updatedAt: timestamp });
      }
      await database.answers.add({
        lessonId,
        index: attempt.index,
        templateId: attempt.templateId,
        seed: attempt.seed,
        difficulty: attempt.difficulty,
        correct: attempt.correct,
        firstTry: attempt.correct,
        attempts: 1,
        hinted: attempt.hinted,
        ...(earned ? { credited: true } : {}),
        answeredAt: timestamp,
      });
    } else {
      await database.answers.update(existing.id, {
        correct: existing.correct || attempt.correct,
        attempts: existing.attempts + 1,
        hinted: existing.hinted || attempt.hinted,
        answeredAt: timestamp,
      });
    }

    await database.progress.put({
      id: PROGRESS_ID,
      lessonId,
      // Plán, stupeň a souboj se opisují z rozehrané lekce, když je volající
      // nepřipomene. Jinak by je druhý pokus v pořadí umazal.
      plan: options.plan ?? running?.plan,
      stageId: options.stageId ?? running?.stageId,
      duelId: options.duelId ?? running?.duelId,
      attempts,
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

    // Co už připsaly jednotlivé odpovědi, se podruhé nepřičítá.
    const credited = await database.answers
      .where("lessonId")
      .equals(lesson.lessonId)
      .filter((answer) => answer.credited === true)
      .count();

    const updated: Profile = {
      ...current,
      pills: current.pills + Math.max(0, lesson.reward.pills - credited * PILLS_PER_CORRECT),
      xp: current.xp + lesson.reward.xp,
      streakDays: streak.days,
      lastLessonDay: streak.lastDay,
      streakFreezes: streak.freezes,
      updatedAt: timestamp,
    };

    await database.profile.put(updated);
    /**
     * Odpovědi zpravidla uložil `recordAnswer` hned po každém pokusu.
     * Zapisují se tady jen tehdy, když po lekci žádné nezůstaly — z testu
     * nebo z obnovy —, aby se nezaložily dvakrát. Tehdy se z nich dá
     * vyčíst jen první pokus; víc se na server neposílá.
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
          firstTry: answer.correct,
          attempts: 1,
          hinted: answer.hinted,
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
        kind: lesson.kind ?? "lesson",
        answers: lesson.answers.map((answer) => ({
          templateId: answer.templateId,
          seed: answer.seed,
          difficulty: answer.difficulty,
          correct: answer.correct,
          hinted: answer.hinted,
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

/**
 * Připíše ochranu série z daru od kamaráda.
 *
 * Prášky se nestrhávají — zaplatil je odesílatel na svém telefonu. Zápis
 * je idempotentní podle identifikátoru daru: kdyby se potvrzení na server
 * nepovedlo a dar přišel znovu, podruhé se už nepřipíše.
 *
 * Vrací `full`, když má příjemce zásobu plnou. Dar pak zůstane nevyzvednutý
 * a připíše se, až bude místo.
 */
export async function claimGift(
  gift: { id: string; fromHandle: string },
  max: number,
  now = new Date(),
): Promise<"ok" | "full" | "known"> {
  const timestamp = now.toISOString();
  const database = db();

  return database.transaction("rw", database.profile, database.gifts, async () => {
    if ((await database.gifts.get(gift.id)) !== undefined) return "known";

    const current = (await database.profile.get(PROFILE_ID)) ?? emptyProfile(now);
    if ((current.streakFreezes ?? 0) >= max) return "full";

    await database.profile.put({
      ...current,
      streakFreezes: (current.streakFreezes ?? 0) + 1,
      updatedAt: timestamp,
    });
    await database.gifts.put({ id: gift.id, fromHandle: gift.fromHandle, receivedAt: timestamp });
    return "ok";
  });
}

/** Dary, které na tomhle zařízení dorazily. Nejnovější první. */
export async function receivedGifts(limit = 5): Promise<ReceivedGiftRecord[]> {
  return db().gifts.orderBy("receivedAt").reverse().limit(limit).toArray();
}
