import type { Category, Difficulty } from "./types";

/**
 * Program: v jakém pořadí se učivo probírá.
 *
 * Pořadí je opsané z praktických cvičení na LF UP Olomouc (Farmakologie 1
 * a 2): tekuté lékové formy → dávkování v dětském věku → parenterální léky
 * → farmakokinetika a monitorování; pak diabetes, akutní stavy a onkologie.
 * Podrobnosti jsou v docs/zdroje.md.
 *
 * **Nic se nezamyká.** Výpočty dávkování nejsou kumulativní jako jazyk —
 * rychlost infuze spočítá i ten, kdo neumí povrch těla — a medik před
 * zkouškou nemá proč se prodírat převody jednotek. Pořadí je doporučení
 * a `requires` slouží k jediné větě („tohle stojí na ředění, které máš
 * na 40 %“), ne k zákazu.
 *
 * V souboru není žádný text ani import šablon. Domovská obrazovka ho
 * načítá staticky a nesmí kvůli němu stáhnout fond přípravků.
 */
export type StageId =
  | "jednotky"
  | "koncentrace"
  | "hmotnost"
  | "priprava"
  | "ledviny"
  | "inzulin"
  | "perfuzory"
  | "povrch";

export type Stage = {
  id: StageId;
  categories: readonly Category[];
  /** Látka, na které stupeň stojí. Vždy dřívější stupeň, viz test. */
  requires: readonly StageId[];
};

export const STAGES: readonly Stage[] = [
  { id: "jednotky", categories: ["prevody", "zaklad"], requires: [] },
  { id: "koncentrace", categories: ["redeni"], requires: ["jednotky"] },
  { id: "hmotnost", categories: ["hmotnost", "pediatrie"], requires: ["jednotky"] },
  { id: "priprava", categories: ["rekonstituce", "infuze"], requires: ["koncentrace"] },
  { id: "ledviny", categories: ["renalni"], requires: ["hmotnost"] },
  { id: "inzulin", categories: ["inzulin"], requires: ["koncentrace"] },
  { id: "perfuzory", categories: ["vazoaktivni"], requires: ["koncentrace", "priprava"] },
  { id: "povrch", categories: ["povrch", "onkologie"], requires: ["hmotnost"] },
];

export function stageById(id: StageId): Stage {
  const stage = STAGES.find((one) => one.id === id);
  if (!stage) throw new Error(`Program nezná stupeň ${id}.`);
  return stage;
}

/* ---------------------------------------------------------------------------
   Zvládnutí
   ------------------------------------------------------------------------ */

/** Pod tímhle počtem odpovědí se o úspěšnosti nedá mluvit. */
export const MASTERY_MIN_ANSWERS = 10;

/** Práh zvládnutí. Rozhoduje ostré „víc než“, ne „aspoň“. */
export const MASTERY_MIN_RATE = 0.8;

/** Součet za kategorii. `correct` je počet správných **napoprvé**. */
export type CategoryScore = { answered: number; correct: number };
export type Scores = ReadonlyMap<Category, CategoryScore>;

export type StageStanding = {
  stage: StageId;
  answered: number;
  correct: number;
  /** Úspěšnost napoprvé; `null`, dokud není z čeho počítat. */
  rate: number | null;
  mastered: boolean;
};

/**
 * Jak student stojí ve stupni.
 *
 * Odpovědi ze všech kategorií stupně se sčítají dohromady. Kdyby se práh
 * měřil po kategoriích, stupeň se dvěma kategoriemi by potřeboval dvojnásob
 * odpovědí než stupeň s jednou — a nikdo by nečetl obojí jako totéž.
 */
export function stageStanding(stage: StageId, scores: Scores): StageStanding {
  let answered = 0;
  let correct = 0;
  for (const category of stageById(stage).categories) {
    const score = scores.get(category);
    if (!score) continue;
    answered += score.answered;
    correct += score.correct;
  }

  const rate = answered === 0 ? null : correct / answered;
  return {
    stage,
    answered,
    correct,
    rate,
    mastered: answered >= MASTERY_MIN_ANSWERS && rate !== null && rate > MASTERY_MIN_RATE,
  };
}

export function allStandings(scores: Scores): StageStanding[] {
  return STAGES.map((stage) => stageStanding(stage.id, scores));
}

export function masteredStages(scores: Scores): Set<StageId> {
  return new Set(allStandings(scores).filter((one) => one.mastered).map((one) => one.stage));
}

/**
 * Stupeň, který má student rozepsaný. První nezvládnutý v pořadí programu;
 * kdo zvládl všechno, zůstává na posledním — pořád je co procvičovat.
 */
export function currentStage(scores: Scores): StageId {
  const standings = allStandings(scores);
  return (standings.find((one) => !one.mastered) ?? standings[standings.length - 1]).stage;
}

/**
 * Látka, na které stupeň stojí a kterou student nemá zvládnutou.
 *
 * Vrací jednu, tu nejslabší — věta na obrazovce má být jedna. Netrvalá
 * podmínka: stupeň jde spustit vždycky, tohle je informace, ne závora.
 */
export function blockingDependency(stage: StageId, scores: Scores): StageStanding | null {
  const unmet = stageById(stage)
    .requires.map((required) => stageStanding(required, scores))
    .filter((standing) => !standing.mastered);
  if (unmet.length === 0) return null;

  // Nezkoušená látka jde první: „ještě jsi to nezkoušel“ je výmluvnější
  // než „máš to na 71 %“.
  return unmet.sort((a, b) => (a.rate ?? -1) - (b.rate ?? -1))[0];
}

/**
 * Z čeho brát opakování. Jen zvládnutá látka — opakovat se dá to, co už
 * jednou sedlo. Řadí se od nejslabší, protože ta potřebuje připomenout
 * nejvíc. Kategorie rozepsaného stupně se vynechají; ty v lekci stejně jsou.
 */
export function reviewCategories(scores: Scores, exclude: StageId): Category[] {
  const excluded = new Set(stageById(exclude).categories);

  const rated: { category: Category; rate: number }[] = [];
  for (const stage of masteredStages(scores)) {
    for (const category of stageById(stage).categories) {
      if (excluded.has(category)) continue;
      const score = scores.get(category);
      if (!score || score.answered === 0) continue;
      rated.push({ category, rate: score.correct / score.answered });
    }
  }

  return rated.sort((a, b) => a.rate - b.rate).map((one) => one.category);
}

/* ---------------------------------------------------------------------------
   Náběh obtížnosti
   ------------------------------------------------------------------------ */

/**
 * Tři pevné náběhy, ne obtížnost počítaná na každý příklad zvlášť. Skrytá
 * proměnná by znamenala, že nikdo neuhádne, proč mu lekce přišla těžká.
 *
 * Lekce vždy končí nejtěžším příkladem — poslední je ten, který si student
 * zapamatuje.
 */
export const RAMPS = {
  /** Málo odpovědí: student látku teprve otevřel. */
  intro: [1, 1, 1, 2, 2, 2, 3],
  /** Rozjeté učivo. Tohle je náběh, který platil pro všechny lekce dřív. */
  standard: [1, 1, 2, 2, 2, 3, 3],
  /** Daří se mu, ale odpovědí je zatím málo na zvládnutí — přitvrdit. */
  push: [2, 2, 2, 3, 3, 3, 3],
} as const satisfies Record<string, readonly Difficulty[]>;

export type RampId = keyof typeof RAMPS;

export function rampFor(standing: StageStanding): RampId {
  if (standing.rate === null || standing.answered < MASTERY_MIN_ANSWERS / 2) return "intro";
  return standing.rate > MASTERY_MIN_RATE ? "push" : "standard";
}

/* ---------------------------------------------------------------------------
   Předpis denní lekce
   ------------------------------------------------------------------------ */

/**
 * Co má dnešní lekce obsahovat. Malý serializovatelný objekt: ukládá se
 * k rozehrané lekci a dá se z něj lekce sestavit znovu.
 */
export type DailySpec = {
  stage: StageId;
  /** Kategorie, ze kterých se losuje opakování. Prázdné u nováčka. */
  review: readonly Category[];
  ramp: RampId;
};
