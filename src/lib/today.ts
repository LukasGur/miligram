import { localDay, previousDay } from "@/core/economy";
import { db, PROFILE_ID } from "./db";

/* ---------------------------------------------------------------------------
   Dnešek a týden

   Domovská obrazovka stojí na jedné otázce: jak jsem na tom dnes.
   Odpověď se počítá z odpovědí, ne z profilu — profil drží celkové součty
   a ty o dnešku nic neříkají.

   Vlastní soubor mají proto, že přehled vedle nich sahá přes `categoryOf`
   na všech 72 šablon i na fond přípravků. Domovská obrazovka by si těch
   300 kB stáhla jen kvůli otázce, kolik příkladů má za sebou dnes.
   ------------------------------------------------------------------------ */

/**
 * Kolik příkladů má uživatel dnes spočítaných.
 *
 * Počítají se vyřešené, ne zodpovězené. Sedm chyb ze sedmi není splněný
 * denní cíl; chybný příklad se v lekci vrací, a jakmile vyjde, cíl se
 * pohne. Druhý pokus tím cíl nepřifoukne — záznam je jeden na příklad.
 *
 * Uložený čas je v UTC, ale den se počítá podle kalendáře uživatele —
 * proto se převádí, místo aby se z řetězce ukrojilo prvních deset znaků.
 * Ve středoevropském létě totiž lekce dohraná o půl jedné v noci padne
 * v UTC ještě na včerejšek a dnešní cíl by se po ní nepohnul.
 */
export async function solvedToday(today = localDay()): Promise<number> {
  const answers = await db().answers.toArray();
  return answers.filter(
    (answer) => answer.correct && localDay(new Date(answer.answeredAt)) === today,
  ).length;
}

/**
 * Typy výpočtu, které dnes v dohraných lekcích zůstaly nespočítané
 * (student je přeskočil). Kvůli nim stojí kruh cíle, i když je lekce
 * hotová — domovská obrazovka to řekne a nabídne opravu hned.
 * Rozehraná lekce se nepočítá: její chyby se ještě vrátí v ní samé.
 */
export async function unsolvedToday(
  today = localDay(),
): Promise<{ templateId: string; difficulty: number }[]> {
  const database = db();
  const finished = new Set((await database.lessons.toArray()).map((lesson) => lesson.lessonId));
  const unique = new Map<string, { templateId: string; difficulty: number }>();
  // V pořadí zápisu: typ, který student dnes později spočítal (třeba
  // v opakování), už na opravu nečeká.
  for (const answer of await database.answers.orderBy("id").toArray()) {
    if (localDay(new Date(answer.answeredAt)) !== today) continue;
    const key = `${answer.templateId}:${answer.difficulty}`;
    if (answer.correct) {
      unique.delete(key);
      continue;
    }
    if (!finished.has(answer.lessonId)) continue;
    unique.set(key, {
      templateId: answer.templateId,
      difficulty: answer.difficulty,
    });
  }
  return [...unique.values()];
}

export type WeekDay = {
  day: string;
  /** Dohrál v ten den uživatel aspoň jednu lekci? */
  active: boolean;
  /** Den bez lekce, který podržela ochrana nebo obnovení. */
  covered: boolean;
  today: boolean;
  /** Den, který teprve přijde. Není to zmeškaný den, jen ještě nenastal. */
  upcoming: boolean;
};

/**
 * Probíhající kalendářní týden, pondělím počínaje.
 *
 * Ne posledních sedm dní končících dneškem: takový pás sice ukazuje totéž
 * množství historie, ale začíná pokaždé jiným dnem a nikdo ho tak nečte.
 * Týden má v ČR i SR pevný začátek a obrazovka se mu má přizpůsobit.
 */
export async function weekActivity(today = localDay()): Promise<WeekDay[]> {
  const [lessons, profile] = await Promise.all([db().lessons.toArray(), db().profile.get(PROFILE_ID)]);
  // Den podle kalendáře uživatele, ne podle UTC — jinak by se lekce dohraná
  // krátce po půlnoci vybarvila u včerejška.
  const played = new Set(lessons.map((lesson) => localDay(new Date(lesson.finishedAt))));
  const covered = new Set(profile?.coveredDays ?? []);

  const [year, month, date] = today.split("-").map(Number);
  const reference = new Date(Date.UTC(year, month - 1, date));
  // getUTCDay() vrací neděli jako nulu; posun udělá z pondělí začátek.
  const sinceMonday = (reference.getUTCDay() + 6) % 7;

  return Array.from({ length: 7 }, (_, index) => {
    const moment = new Date(Date.UTC(year, month - 1, date - sinceMonday + index));
    const day = moment.toISOString().slice(0, 10);
    const active = played.has(day);
    return { day, active, covered: !active && covered.has(day), today: day === today, upcoming: day > today };
  });
}

export type FreezeNews = {
  /** Dny, které ochrana podržela, od nejstaršího. */
  days: string[];
  /** Den, na který ochrana nezbyla a série spadla. */
  fell: string | null;
};

/**
 * Co se má den po půlnoci říct o ochraně. Jen ten den: ochrana podržela
 * včerejšek, nebo podržela předevčírem a na včerejšek už nezbyla.
 * Den v týdenním pruhu zůstane obarvený i potom, věta ne.
 */
export async function freezeNews(today = localDay()): Promise<FreezeNews | null> {
  const [lessons, profile] = await Promise.all([db().lessons.toArray(), db().profile.get(PROFILE_ID)]);
  const frozen = new Set(profile?.frozenDays ?? []);
  const covered = new Set(profile?.coveredDays ?? []);
  const played = new Set(lessons.map((lesson) => localDay(new Date(lesson.finishedAt))));
  const yesterday = previousDay(today);

  const run = (end: string) => {
    const days: string[] = [];
    for (let day = end; frozen.has(day); day = previousDay(day)) days.unshift(day);
    return days;
  };
  if (frozen.has(yesterday)) return { days: run(yesterday), fell: null };
  const before = previousDay(yesterday);
  if (frozen.has(before) && !covered.has(yesterday) && !played.has(yesterday)) {
    return { days: run(before), fell: yesterday };
  }
  return null;
}
