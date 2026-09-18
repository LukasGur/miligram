import { localDay } from "@/core/economy";
import { db } from "./db";

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
 * Kolik příkladů uživatel zodpověděl dnes.
 *
 * Uložený čas je v UTC, ale den se počítá podle kalendáře uživatele —
 * proto se převádí, místo aby se z řetězce ukrojilo prvních deset znaků.
 * Ve středoevropském létě totiž lekce dohraná o půl jedné v noci padne
 * v UTC ještě na včerejšek a dnešní cíl by se po ní nepohnul.
 */
export async function answeredToday(today = localDay()): Promise<number> {
  const answers = await db().answers.toArray();
  return answers.filter((answer) => localDay(new Date(answer.answeredAt)) === today).length;
}

export type WeekDay = {
  day: string;
  /** Dohrál v ten den uživatel aspoň jednu lekci? */
  active: boolean;
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
  const lessons = await db().lessons.toArray();
  // Den podle kalendáře uživatele, ne podle UTC — jinak by se lekce dohraná
  // krátce po půlnoci vybarvila u včerejška.
  const played = new Set(lessons.map((lesson) => localDay(new Date(lesson.finishedAt))));

  const [year, month, date] = today.split("-").map(Number);
  const reference = new Date(Date.UTC(year, month - 1, date));
  // getUTCDay() vrací neděli jako nulu; posun udělá z pondělí začátek.
  const sinceMonday = (reference.getUTCDay() + 6) % 7;

  return Array.from({ length: 7 }, (_, index) => {
    const moment = new Date(Date.UTC(year, month - 1, date - sinceMonday + index));
    const day = moment.toISOString().slice(0, 10);
    return { day, active: played.has(day), today: day === today, upcoming: day > today };
  });
}
