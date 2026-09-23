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

const WHOLE = [1, 2, 5, 10, 25, 50, 100, 250, 500] as const;
const FRACTIONAL = [0.125, 0.25, 1.25, 1.5, 2.5, 3.75, 6.25, 7.5, 62.5] as const;

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

    // Desetinné zadání dává smysl jen směrem nahoru — dolů by odpověď utekla.
    const value = goesUp && difficulty === 3 ? rng.pick(FRACTIONAL) : rng.pick(WHOLE);
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
