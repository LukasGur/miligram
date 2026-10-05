import { convert, type Unit } from "../units";
import * as tolerances from "../tolerances";
import type { AnswerUnit, Solution } from "../types";
import { formula, given, q, result, substitute, tex, unit } from "./helpers";
import { register, SI_SOURCE } from "./registry";

/**
 * Převody „nahoru“ (z větší jednotky na menší) číslo zvětšují, takže
 * z hezkého zadání vyjde hezká odpověď. Převody „dolů“ ho zmenšují —
 * tam se smí losovat jen celé číslo, jinak by odpověď měla víc desetinných
 * míst, než kolik jich uživatel může zadat.
 */
const UP: readonly (readonly [Unit, Unit])[] = [
  ["g", "mg"],
  ["mg", "µg"],
  ["µg", "ng"],
];
const UP_TWO: readonly (readonly [Unit, Unit])[] = [
  ["g", "µg"],
  ["mg", "ng"],
];
const DOWN: readonly (readonly [Unit, Unit])[] = [
  ["mg", "g"],
  ["µg", "mg"],
  ["ng", "µg"],
];

/**
 * Hodnoty pro každý převod zvlášť. Jedna společná tabulka dávala
 * „500 g → mg“ nebo „50 mg → ng“ (50 000 000): převody, které nikdo
 * nedělá. Gramy jsou tu jako u antibiotik, mikrogramy jako u digoxinu
 * nebo levotyroxinu, nanogramy jen tam, kde dávají smysl. Dvoustupňový
 * převod začíná u malých hodnot, aby výsledek zůstal čitelný.
 * `easy` jsou kulaté hodnoty, `hard` přidávají desetiny a čtvrtiny.
 */
const VALUES: Record<string, { easy: readonly number[]; hard: readonly number[] }> = {
  "g>mg": { easy: [1, 2, 4], hard: [0.25, 0.5, 0.75, 1.2, 1.5] },
  "mg>µg": { easy: [1, 2, 5, 10], hard: [0.05, 0.1, 0.125, 0.25, 0.4, 2.5] },
  "µg>ng": { easy: [1, 2, 5], hard: [0.1, 0.25, 0.5, 1.5] },
  "g>µg": { easy: [0.001, 0.002, 0.005], hard: [0.003, 0.015, 0.025, 0.05] },
  "mg>ng": { easy: [0.001, 0.002, 0.005], hard: [0.003, 0.015, 0.025] },
  "mg>g": { easy: [500, 1000, 2000], hard: [125, 250, 750, 1200, 1500] },
  "µg>mg": { easy: [500, 1000, 2000], hard: [50, 125, 250, 400, 750] },
  "ng>µg": { easy: [500, 1000, 2000], hard: [100, 250, 750, 1500] },
};

const UNIT_LABEL: Record<string, AnswerUnit> = { ng: "ng", "µg": "ug", mg: "mg", g: "g" };

/**
 * H1 — převod mezi gramy, miligramy, mikrogramy a nanogramy.
 *
 * Nejjednodušší převod v aplikaci, a přesto zdroj chyby s nejtěžšími
 * následky: dávka o tři řády vedle se nepozná podle jednotky, ale podle
 * toho, kolik toho pacient dostal.
 */
export const H1 = register({
  id: "H1",
  category: "prevody",
  source: SI_SOURCE,

  generate(rng, difficulty) {
    const up = difficulty === 1 ? UP : difficulty === 2 ? UP_TWO : [...UP, ...UP_TWO];
    const goesUp = difficulty === 3 ? rng.int(0, 2) > 0 : rng.int(0, 1) === 1;
    const [from, to] = goesUp ? rng.pick(up) : rng.pick(DOWN);

    // Hodnota, jaká v té jednotce opravdu stojí na obalu nebo v ordinaci.
    const values = VALUES[`${from}>${to}`];
    const value = difficulty === 3 ? rng.pick([...values.easy, ...values.hard]) : rng.pick(values.easy);
    return { value, from, to };
  },

  solve(vars): Solution {
    const from = String(vars.from) as Unit;
    const to = String(vars.to) as Unit;
    const value = Number(vars.value);
    const converted = convert(value, from, to);
    /** Kolikrát je zdrojová jednotka větší než cílová — celé jádro převodu. */
    const factor = convert(1, from, to);

    return {
      value: converted,
      steps: [
        given(q(value, from, 3)),
        formula(`1${unit(from)} = ${tex(factor, 6)}${unit(to)}`),
        substitute(`${q(value, from, 3)} \\times ${q(factor, `${to}/${from}`, 6)}`, q(converted, to, 3)),
        result(converted, to, 3),
      ],
      roundingNoteKey: "zaokrouhleniPrevod",
    };
  },

  answer(vars, solution) {
    return {
      unit: UNIT_LABEL[String(vars.to)],
      tolerance: tolerances.countable(),
      decimals: tolerances.decimalsFor(solution.value, tolerances.countable(), 3),
    };
  },
});
