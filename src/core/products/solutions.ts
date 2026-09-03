import type { Source } from "../types";

/**
 * Roztoky, které se v praxi označují procenty.
 *
 * Procentní zápis je definice, ne vlastnost přípravku: 1 % je 1 g ve 100 ml.
 * Do tabulky se proto neopisuje přepočet, ale to, co SPC skutečně tvrdí —
 * kolik gramů léčivé látky je v litru. Číslo v mg/ml z toho plyne.
 *
 * Ionty tady nejsou; ty patří do electrolytes.ts, protože u nich SPC uvádí
 * navíc látkové množství.
 */
export type PercentSolution = {
  suklCode: string;
  product: string;
  spc: string;
  substance: string;
  /** Procentní označení tak, jak je na obalu. */
  percent: number;
  /** Hmotnostní koncentrace v mg/ml. */
  mgPerMl: number;
  /** Objemy balení podle DLP, v ml. */
  packSizesMl: readonly number[];
  quote: string;
};

const GLUCOSE_QUOTE =
  "1000 ml infuzního roztoku obsahuje: Ardeanutrisol G 5% / G 10% / G 20% / G 40% — " +
  "Glucosum: 50,0 g / 100,0 g / 200,0 g / 400,0 g.";

export const PERCENT_SOLUTIONS = {
  glukoza5: {
    suklCode: "0032348",
    product: "Ardeanutrisol G 5% infuzní roztok",
    spc: "SPC123043.pdf",
    substance: "GLUKÓZA",
    percent: 5,
    mgPerMl: 50,
    packSizesMl: [100, 250, 500, 1000],
    quote: GLUCOSE_QUOTE,
  },

  glukoza10: {
    suklCode: "0032350",
    product: "Ardeanutrisol G 10% infuzní roztok",
    spc: "SPC123043.pdf",
    substance: "GLUKÓZA",
    percent: 10,
    mgPerMl: 100,
    packSizesMl: [100, 250, 500],
    quote: GLUCOSE_QUOTE,
  },

  glukoza20: {
    suklCode: "0032352",
    product: "Ardeanutrisol G 20% infuzní roztok",
    spc: "SPC123043.pdf",
    substance: "GLUKÓZA",
    percent: 20,
    mgPerMl: 200,
    packSizesMl: [100, 250, 500],
    quote: GLUCOSE_QUOTE,
  },

  glukoza40: {
    suklCode: "0032360",
    product: "Ardeanutrisol G 40% infuzní roztok",
    spc: "SPC123046.pdf",
    substance: "GLUKÓZA",
    percent: 40,
    mgPerMl: 400,
    packSizesMl: [100, 250],
    quote: GLUCOSE_QUOTE,
  },
} as const satisfies Record<string, PercentSolution>;

export type PercentSolutionId = keyof typeof PERCENT_SOLUTIONS;

export const PERCENT_SOLUTION_LIST = Object.entries(PERCENT_SOLUTIONS) as ReadonlyArray<
  readonly [PercentSolutionId, PercentSolution]
>;

export function percentSolution(id: PercentSolutionId): PercentSolution {
  return PERCENT_SOLUTIONS[id];
}

export function percentSolutionSource(id: PercentSolutionId): Source {
  const item = PERCENT_SOLUTIONS[id];
  return {
    citation: `SÚKL, SPC přípravku ${item.product}, bod 2: „${item.quote}“`,
    url: "https://opendata.sukl.cz/?q=katalog/spc-souhrn-udaju-o-lecivem-pripravku-summary-product-characteristics",
    suklCode: item.suklCode,
    verifiedAt: "2026-09-03",
  };
}
