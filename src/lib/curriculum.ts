import {
  allStandings,
  blockingDependency,
  currentStage,
  rampFor,
  reviewCategories,
  stageStanding,
  type DailySpec,
  type Scores,
  type StageId,
  type StageStanding,
} from "@/core/curriculum";
import { categoryOfId } from "@/core/templateCategories";
import type { Category } from "@/core/types";
import { DAILY_REVIEW_ITEMS } from "@/core/lessonPlan";
import { db } from "./db";
import { mistakesToRepeat, type Mistake } from "./stats";

/**
 * Kde student v programu stojí.
 *
 * Databázi čte tenhle soubor, počítá `core/curriculum.ts` — stejná dělba
 * jako u statistik a ekonomiky. Díky ní se dá program testovat bez
 * IndexedDB a obrazovky se k němu dostanou přes jeden hook.
 *
 * Nikde se tu nesahá na šablony: kategorie se čte z ploché tabulky, aby
 * domovská obrazovka nestáhla fond přípravků.
 */
export type CurriculumState = {
  /** Součty po kategoriích. Nese se s sebou, ať se databáze čte jednou. */
  scores: Scores;
  standings: StageStanding[];
  current: StageId;
  /** Neopravené chyby, nejstarší první. Denní lekce z nich bere na opakování. */
  mistakes: Mistake[];
};

/**
 * Součty odpovědí po kategoriích. Počítá se z prvního pokusu — opakovaný
 * příklad se v lekci vrací, dokud nevyjde, takže „vyřešeno“ nakonec platí
 * skoro o všem a jako měřítko by nic neřeklo.
 */
export async function categoryScores(): Promise<Scores> {
  const answers = await db().answers.toArray();
  const scores = new Map<Category, { answered: number; correct: number }>();

  for (const answer of answers) {
    const category = categoryOfId(answer.templateId);
    // Šablona, kterou aplikace už nezná. Historie ji přežije a program
    // se kvůli ní nesmí položit.
    if (category === null) continue;

    const bucket = scores.get(category) ?? { answered: 0, correct: 0 };
    bucket.answered += 1;
    if (answer.firstTry) bucket.correct += 1;
    scores.set(category, bucket);
  }

  return scores;
}

export async function curriculumState(): Promise<CurriculumState> {
  const [scores, mistakes] = await Promise.all([categoryScores(), mistakesToRepeat(DAILY_REVIEW_ITEMS)]);
  return { scores, standings: allStandings(scores), current: currentStage(scores), mistakes };
}

/**
 * Předpis lekce. Bez argumentu míří na rozepsaný stupeň, se stupněm na ten,
 * který si student vybral v programu — opakování se pak počítá vůči němu,
 * ne vůči tomu rozepsanému.
 */
export function dailySpec(state: CurriculumState, stage: StageId = state.current): DailySpec {
  return {
    stage,
    review: reviewCategories(state.scores, stage),
    ramp: rampFor(stageStanding(stage, state.scores)),
    mistakes: state.mistakes,
  };
}

/** Látka, na které vybraný stupeň stojí a kterou student nemá zvládnutou. */
export function blockingFor(state: CurriculumState, stage: StageId): StageStanding | null {
  return blockingDependency(stage, state.scores);
}
