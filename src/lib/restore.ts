import { advanceStreak, localDay, type StreakState } from "@/core/economy";
import { scoreLesson, type LessonKind } from "@/core/scoring";
import { db, PROFILE_ID, emptyProfile, type AnswerRecord, type LessonRecord } from "./db";

/**
 * Obnova historie ze serveru.
 *
 * Fronta je jednosměrná a to je záměr: zařízení hlásí, co se stalo, server
 * si skóre spočítá sám. Chybí ale opačný směr pro jediný případ, kdy ho je
 * potřeba — čerstvá instalace. Bez něj se uživatel přihlásí na novém
 * telefonu, doma vidí nulu a vedle v lize svoje skutečné XP.
 *
 * Stahuje se totéž, co se posílalo: co se stalo. Skóre se z toho počítá
 * znovu týmiž pravidly, takže se nemůže rozejít s tím, co drží server.
 *
 * Prášky se neobnovují. Jsou měna a jejich útrata se nikam neposílá, takže
 * server zná jen výdělek — obnovit z něj zůstatek by znamenalo vrátit
 * i všechno utracené. Zůstávají věcí zařízení, jak je rozhodnuté ve fázi 5.
 */
export type RemoteLesson = {
  lessonId: string;
  finishedAt: string;
  kind: LessonKind;
  answers: readonly {
    templateId: string;
    seed: string;
    difficulty: number;
    correct: boolean;
    hinted: boolean;
  }[];
};

export type RestoreGateway = {
  /**
   * Lekce uživatele od nejstarší. `since` omezuje dotaz na to, co se stalo
   * od poslední návštěvy — při běžném spuštění se tak nevrací nic.
   */
  pullLessons(since?: string): Promise<readonly RemoteLesson[]>;
};

export type RestoreResult = {
  /** Kolik lekcí přibylo. Nula znamená, že zařízení už všechno mělo. */
  added: number;
  /** XP po sloučení. Počítá se z historie, ne z toho, co bylo uložené. */
  xp: number;
};

/**
 * Sloučí serverovou historii s tím, co je na zařízení.
 *
 * Slučuje se podle `lessonId`, který vzniká z času a náhody, takže je
 * jedinečný napříč zařízeními. Díky tomu nezáleží na pořadí: ať se dřív
 * odešle fronta, nebo stáhne historie, každá lekce skončí uložená jednou.
 */
export async function restoreLessons(gateway: RestoreGateway, since?: string): Promise<RestoreResult> {
  const remote = await gateway.pullLessons(since);
  const database = db();

  return database.transaction("rw", database.profile, database.answers, database.lessons, async () => {
    const known = new Set((await database.lessons.toArray()).map((lesson) => lesson.lessonId));
    const fresh = remote.filter((lesson) => !known.has(lesson.lessonId));

    const answers: AnswerRecord[] = [];
    const lessons: LessonRecord[] = [];
    for (const lesson of fresh) {
      const score = scoreLesson(
        lesson.answers.map((answer) => answer.correct),
        lesson.kind,
      );
      lessons.push({
        lessonId: lesson.lessonId,
        count: score.count,
        correct: score.correct,
        flawless: score.flawless,
        xp: score.xp,
        // Výdělek se neobnovuje, viz komentář nahoře. Nula tady neznamená
        // „lekce nic nevynesla“, ale „prášky z ní zůstaly na starém zařízení“.
        pills: 0,
        finishedAt: lesson.finishedAt,
      });
      answers.push(
        ...lesson.answers.map((answer, index) => ({
          lessonId: lesson.lessonId,
          index,
          templateId: answer.templateId,
          seed: answer.seed,
          difficulty: answer.difficulty,
          // Server zná jen první pokus: opakování se mu neposílá.
          correct: answer.correct,
          firstTry: answer.correct,
          attempts: 1,
          hinted: answer.hinted,
          // Čas jednotlivé odpovědi se na server neposílá — stačí čas konce
          // lekce. Statistiky počítají po dnech, a ten den sedí.
          answeredAt: lesson.finishedAt,
        })),
      );
    }

    if (answers.length > 0) await database.answers.bulkAdd(answers);
    if (lessons.length > 0) await database.lessons.bulkAdd(lessons);

    const all = await database.lessons.toArray();
    const current = (await database.profile.get(PROFILE_ID)) ?? emptyProfile();
    const streak = streakFromHistory(all, current.streakFreezes ?? 0);

    await database.profile.put({
      ...current,
      // XP se přepočítá z celé historie, ne přičtením. Kdyby se přičítalo,
      // druhé spuštění obnovy by skóre nafouklo.
      xp: all.reduce((sum, lesson) => sum + lesson.xp, 0),
      streakDays: streak.days,
      lastLessonDay: streak.lastDay,
      updatedAt: new Date().toISOString(),
    });

    return { added: fresh.length, xp: all.reduce((sum, lesson) => sum + lesson.xp, 0) };
  });
}

/**
 * Série z historie.
 *
 * Skládá se den po dni týmž pravidlem, jaké sérii posouvá při hraní —
 * jinak by obnovená série znamenala něco jiného než odehraná. Ochrany
 * se do minulosti neuplatňují: kupovaly by se zpětně na dny, které už
 * proběhly.
 */
function streakFromHistory(lessons: readonly LessonRecord[], freezes: number): StreakState {
  // Den podle kalendáře uživatele, stejně jako při hraní.
  const days = [...new Set(lessons.map((lesson) => localDay(new Date(lesson.finishedAt))))].sort();
  let state: StreakState = { days: 0, lastDay: null, freezes: 0 };
  for (const day of days) state = advanceStreak(state, day);
  return { ...state, freezes };
}

/**
 * Stažení toho, co zařízení nezná.
 *
 * Poprvé na účet stáhne celou historii — to je obnova po přeinstalaci.
 * Podruhé a dál se ptá jen na to, co se stalo od nejnovější známé lekce,
 * takže běžné spuštění vrátí prázdno a zaplatí jeden dotaz. Díky tomu se
 * doženou i dvě zařízení téhož uživatele: co se odehrálo na tabletu,
 * dorazí do telefonu při jeho příštím spuštění.
 *
 * Meze se posouvají až po úspěchu, takže přerušené stahování se příště
 * zkusí znovu. Hranice je včetně (`>=`) — lekce se stejným časem by při
 * ostrém `>` propadla. Podruhé stažená lekce nevadí, slučuje se
 * podle `lessonId`.
 */
export async function pullNews(userId: string, gateway: RestoreGateway): Promise<RestoreResult> {
  const database = db();
  const current = (await database.profile.get(PROFILE_ID)) ?? emptyProfile();
  // Po přihlášení k jinému účtu se ptáme znovu na všechno: historie toho
  // druhého na zařízení není.
  const since = current.restoredFor === userId ? current.restoredThrough : undefined;

  const result = await restoreLessons(gateway, since);

  const newest = await database.lessons.orderBy("finishedAt").last();
  const after = (await database.profile.get(PROFILE_ID)) ?? emptyProfile();
  await database.profile.put({
    ...after,
    restoredFor: userId,
    restoredThrough: newest?.finishedAt ?? since,
    updatedAt: new Date().toISOString(),
  });
  return result;
}
