import { advanceStreak, localDay, type StreakState } from "@/core/economy";
import { scoreLesson } from "@/core/scoring";
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
  answers: readonly {
    templateId: string;
    seed: string;
    difficulty: number;
    correct: boolean;
    hinted: boolean;
    repaired: boolean;
  }[];
};

export type RestoreGateway = {
  /** Všechny lekce uživatele, od nejstarší. */
  pullLessons(): Promise<readonly RemoteLesson[]>;
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
export async function restoreLessons(gateway: RestoreGateway): Promise<RestoreResult> {
  const remote = await gateway.pullLessons();
  const database = db();

  return database.transaction("rw", database.profile, database.answers, database.lessons, async () => {
    const known = new Set((await database.lessons.toArray()).map((lesson) => lesson.lessonId));
    const fresh = remote.filter((lesson) => !known.has(lesson.lessonId));

    const answers: AnswerRecord[] = [];
    const lessons: LessonRecord[] = [];
    for (const lesson of fresh) {
      const score = scoreLesson(lesson.answers.map((answer) => answer.correct));
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
          correct: answer.correct,
          hinted: answer.hinted,
          repaired: answer.repaired,
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
 * Obnova při přihlášení, nejvýš jednou na účet a zařízení.
 *
 * Značka se ukládá do profilu, ne do paměti — jinak by se celá historie
 * stahovala po každém otevření aplikace. Zapíše se až po úspěchu, takže
 * přerušené stahování se příště zkusí znovu.
 */
export async function restoreOnce(userId: string, gateway: RestoreGateway): Promise<RestoreResult | null> {
  const database = db();
  const current = (await database.profile.get(PROFILE_ID)) ?? emptyProfile();
  if (current.restoredFor === userId) return null;

  const result = await restoreLessons(gateway);

  const after = (await database.profile.get(PROFILE_ID)) ?? emptyProfile();
  await database.profile.put({ ...after, restoredFor: userId, updatedAt: new Date().toISOString() });
  return result;
}
