import Dexie, { type Table } from "dexie";
import type { StageId } from "@/core/curriculum";
import { MAX_STREAK_FREEZES, PILLS_PER_CORRECT, advanceStreak, localDay, previousDay, type StreakState } from "@/core/economy";
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
  /**
   * Účet, kterému data v telefonu patří. Chybí, dokud se hraje bez účtu.
   * Synchronizace běží jen pro vlastníka — jinak by se po přihlášení
   * jiného účtu jeho data smíchala s cizími (src/lib/account.ts).
   */
  ownerId?: string;
  /**
   * Zůstatek z doby, kdy pastilky žily jen v telefonu. Pohyby tehdy nikam
   * nešly, takže se na server pošle jednou jako počáteční stav — až bude
   * jasné, komu patří. Nové pohyby už jdou frontou samy.
   */
  opening?: { pills: number; freezes: number };
  /**
   * Dny, které podržela ochrana série. Bez nich by série složená znovu
   * z historie (obnova, nový telefon) po každé ochraně spadla na jedničku.
   */
  coveredDays?: string[];
  /**
   * Na bonus za registraci už se zařízení ptalo. Server ho připíše jednou
   * na účet, tohle jen šetří dotaz při každém spuštění.
   */
  bonusChecked?: boolean;
  /** Den posledního obnovení série. Obnovit jde nejvýš jednou za třicet dní. */
  lastRepair?: string;
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
  /**
   * `pillsSpent` je z doby před peněženkou na serveru; nikam se neposílá
   * a verze 8 ho označila za vyřízený. Nové pohyby jsou `wallet`.
   */
  type: "lessonFinished" | "pillsSpent" | "wallet";
  payload: Record<string, unknown>;
  createdAt: string;
  /** Doplní se po odeslání; do té doby je událost čekající. */
  syncedAt?: string;
  /** Server událost odmítl (src/lib/sync.ts); už se neposílá. */
  rejectedAt?: string;
};

/**
 * Pohyb v peněžence. Posílá se, co se stalo — „+2 za příklad“, „−15 za
 * nápovědu“ —, ne zůstatek; zůstatek je na serveru součet (migrace 0014).
 */
export type WalletKind = "earn" | "spend" | "freezeGained" | "freezeUsed" | "opening" | "repair";

export type WalletPayload = {
  kind: WalletKind;
  pills: number;
  freezes: number;
  reason: string;
  /** Den pokrytý ochranou, YYYY-MM-DD. */
  day?: string;
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

/**
 * Výhra ze souboje, kterou si zařízení připsalo. Pastilky žijí v telefonu
 * (migrace 0006), takže o výhře rozhodne server a zařízení si ji připíše
 * samo — jednou, podle identifikátoru souboje.
 */
export type DuelRewardRecord = { id: string; pills: number; creditedAt: string };

/** Nejvyšší dosažený stupeň odznaku. Odznak nemizí, když série spadne. */
export type BadgeRecord = { id: string; level: number; earnedAt: string };

class MiligramDatabase extends Dexie {
  profile!: Table<Profile, number>;
  answers!: Table<AnswerRecord, number>;
  lessons!: Table<LessonRecord, number>;
  outbox!: Table<OutboxEvent, number>;
  progress!: Table<LessonProgress, number>;
  gifts!: Table<ReceivedGiftRecord, string>;
  duelRewards!: Table<DuelRewardRecord, string>;
  badges!: Table<BadgeRecord, string>;

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

    /** Sedmá verze: připsané výhry ze soubojů a dosažené odznaky. */
    this.version(7).stores({ duelRewards: "id", badges: "id" });

    /**
     * Osmá verze: peněženka na serveru. Dosavadní zůstatek se odloží jako
     * počáteční stav a pošle se, až bude jasné, komu patří. Staré útraty
     * se neposílají — jsou v tom zůstatku už odečtené.
     */
    this.version(8).upgrade(async (transaction) => {
      await transaction
        .table<Profile>("profile")
        .toCollection()
        .modify((profile) => {
          const freezes = profile.streakFreezes ?? 0;
          if (profile.opening === undefined && (profile.pills > 0 || freezes > 0)) {
            profile.opening = { pills: profile.pills, freezes };
          }
        });
      const now = new Date().toISOString();
      await transaction
        .table<OutboxEvent>("outbox")
        .where("type")
        .equals("pillsSpent")
        .modify((event) => {
          event.syncedAt ??= now;
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

/**
 * Zařadí pohyb v peněžence do fronty. Uid bývá odvozené z toho, co pohyb
 * způsobilo (`earn:lekce:semínko`, `gift:id`), takže se tentýž pohyb
 * nezařadí dvakrát ani tehdy, když se zápis zopakuje. Volá se uvnitř
 * transakce, která drží frontu.
 */
async function queueWallet(uid: string, payload: WalletPayload, timestamp: string): Promise<void> {
  const outbox = db().outbox;
  if ((await outbox.where("uid").equals(uid).count()) > 0) return;
  await outbox.add({ uid, type: "wallet", payload, createdAt: timestamp });
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

  const tables = [database.answers, database.progress, database.profile, database.outbox];
  await database.transaction("rw", tables, async () => {
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
        await queueWallet(
          `earn:${lessonId}:${attempt.seed}`,
          { kind: "earn", pills: PILLS_PER_CORRECT, freezes: 0, reason: "answer" },
          timestamp,
        );
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
      {
        days: current.streakDays,
        lastDay: current.lastLessonDay,
        freezes: current.streakFreezes ?? 0,
        covered: current.coveredDays,
      },
      today,
    );

    // Co už připsaly jednotlivé odpovědi, se podruhé nepřičítá.
    const credited = await database.answers
      .where("lessonId")
      .equals(lesson.lessonId)
      .filter((answer) => answer.credited === true)
      .count();

    const earned = Math.max(0, lesson.reward.pills - credited * PILLS_PER_CORRECT);
    /**
     * Ochrana podržela včerejšek. Den se zapíše, aby ho znala i série
     * složená znovu z historie — na novém telefonu i u kamarádů.
     */
    const frozeDay = streak.freezes < (current.streakFreezes ?? 0) ? previousDay(today) : null;

    const updated: Profile = {
      ...current,
      pills: current.pills + earned,
      xp: current.xp + lesson.reward.xp,
      streakDays: streak.days,
      lastLessonDay: streak.lastDay,
      streakFreezes: streak.freezes,
      ...(frozeDay ? { coveredDays: [...(current.coveredDays ?? []), frozeDay] } : {}),
      updatedAt: timestamp,
    };

    await database.profile.put(updated);
    if (earned > 0) {
      await queueWallet(
        `lesson:${lesson.lessonId}`,
        { kind: "earn", pills: earned, freezes: 0, reason: "lesson" },
        timestamp,
      );
    }
    if (frozeDay) {
      await queueWallet(
        `freeze:${frozeDay}`,
        { kind: "freezeUsed", pills: 0, freezes: -1, reason: "streak", day: frozeDay },
        timestamp,
      );
    }
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
    await queueWallet(eventUid(), { kind: "spend", pills: -amount, freezes: 0, reason }, timestamp);
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
    await queueWallet(eventUid(), { kind: "spend", pills: -cost, freezes: 1, reason: "streakFreeze" }, timestamp);
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

  return database.transaction("rw", database.profile, database.gifts, database.outbox, async () => {
    if ((await database.gifts.get(gift.id)) !== undefined) return "known";

    const current = (await database.profile.get(PROFILE_ID)) ?? emptyProfile(now);
    if ((current.streakFreezes ?? 0) >= max) return "full";

    await database.profile.put({
      ...current,
      streakFreezes: (current.streakFreezes ?? 0) + 1,
      updatedAt: timestamp,
    });
    await database.gifts.put({ id: gift.id, fromHandle: gift.fromHandle, receivedAt: timestamp });
    await queueWallet(`gift:${gift.id}`, { kind: "freezeGained", pills: 0, freezes: 1, reason: "gift" }, timestamp);
    return "ok";
  });
}

/** Dary, které na tomhle zařízení dorazily. Nejnovější první. */
export async function receivedGifts(limit = 5): Promise<ReceivedGiftRecord[]> {
  return db().gifts.orderBy("receivedAt").reverse().limit(limit).toArray();
}

/**
 * Připíše pastilky za rozhodnutý souboj. Idempotentní podle souboje:
 * seznam soubojů se načítá opakovaně a výhra se nesmí připsat dvakrát.
 *
 * Souboj rozhodnutý dřív, než na zařízení vznikl profil, se jen poznamená:
 * nová instalace by si jinak připsala celou historii výher znovu.
 */
export async function creditDuelReward(
  duel: { id: string; resolvedAt: string | null },
  pills: number,
  now = new Date(),
): Promise<boolean> {
  const timestamp = now.toISOString();
  const database = db();

  return database.transaction("rw", database.profile, database.duelRewards, database.outbox, async () => {
    if ((await database.duelRewards.get(duel.id)) !== undefined) return false;

    const current = (await database.profile.get(PROFILE_ID)) ?? emptyProfile(now);
    const before = duel.resolvedAt !== null && duel.resolvedAt < current.createdAt;
    const amount = before ? 0 : pills;

    await database.duelRewards.put({ id: duel.id, pills: amount, creditedAt: timestamp });
    if (amount > 0) {
      await database.profile.put({ ...current, pills: current.pills + amount, updatedAt: timestamp });
      await queueWallet(`duel:${duel.id}`, { kind: "earn", pills: amount, freezes: 0, reason: "duel" }, timestamp);
    }
    return amount > 0;
  });
}

export async function storedBadgeLevels(): Promise<Record<string, number>> {
  const rows = await db().badges.toArray();
  return Object.fromEntries(rows.map((row) => [row.id, row.level]));
}

/** Uloží vyšší stupně; nižší nepřepíše. */
export async function saveBadgeLevels(levels: Readonly<Record<string, number | undefined>>, now = new Date()): Promise<void> {
  const database = db();
  await database.transaction("rw", database.badges, async () => {
    for (const [id, level] of Object.entries(levels)) {
      if (!level) continue;
      const current = await database.badges.get(id);
      if (current && current.level >= level) continue;
      await database.badges.put({ id, level, earnedAt: now.toISOString() });
    }
  });
}

/**
 * Peněženka, jak ji zná server: součet odeslaných pohybů a dny pokryté
 * ochranou (my_wallet, migrace 0014).
 */
export type ServerWallet = {
  pills: number;
  freezes: number;
  coveredDays: readonly string[];
  /** Den posledního placeného obnovení série. */
  lastRepair?: string | null;
};

/**
 * Srovná zůstatek v telefonu se serverem.
 *
 * Zůstatek = co zná server + co ještě čeká ve frontě. Tím se doženou dvě
 * zařízení téhož účtu (útrata na tabletu se ukáže v telefonu) a čerstvá
 * instalace dostane zpátky svoje pastilky. Pohyb, který se zrovna odesílá,
 * může na chvíli chybět v obou — srovná se příště.
 *
 * Vrací, jestli přibyly dny pokryté ochranou, o kterých telefon nevěděl.
 */
export async function reconcileWallet(wallet: ServerWallet, now = new Date()): Promise<boolean> {
  const database = db();
  return database.transaction("rw", database.profile, database.outbox, async () => {
    const pending = await database.outbox
      .filter((event) => event.syncedAt === undefined && event.type === "wallet")
      .toArray();
    const waiting = pending.reduce(
      (sum, event) => {
        const payload = event.payload as WalletPayload;
        return { pills: sum.pills + payload.pills, freezes: sum.freezes + payload.freezes };
      },
      { pills: 0, freezes: 0 },
    );

    const current = (await database.profile.get(PROFILE_ID)) ?? emptyProfile(now);
    // Počáteční stav, který ještě neodešel, v součtu na serveru chybí.
    const opening = current.opening ?? { pills: 0, freezes: 0 };
    const known = new Set(current.coveredDays ?? []);
    const coveredDays = [...new Set([...known, ...wallet.coveredDays])].sort();
    const lastRepair = [current.lastRepair, wallet.lastRepair ?? undefined].filter(Boolean).sort().at(-1);

    await database.profile.put({
      ...current,
      pills: Math.max(0, wallet.pills + waiting.pills + opening.pills),
      streakFreezes: Math.min(MAX_STREAK_FREEZES, Math.max(0, wallet.freezes + waiting.freezes + opening.freezes)),
      coveredDays,
      ...(lastRepair ? { lastRepair } : {}),
      updatedAt: now.toISOString(),
    });
    return coveredDays.length > known.size;
  });
}

/** Poznamená, že se na bonus za registraci už zařízení ptalo. */
export async function markBonusChecked(): Promise<void> {
  const database = db();
  await database.transaction("rw", database.profile, async () => {
    const current = (await database.profile.get(PROFILE_ID)) ?? emptyProfile();
    await database.profile.put({ ...current, bonusChecked: true });
  });
}
