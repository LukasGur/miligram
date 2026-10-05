import { weightBasedDose } from "../formulas";
import { dosingRule, dosingSource, type DosingRuleId } from "../products/dosing";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { formula, given, q, result, substitute, tex } from "./helpers";
import { register } from "./registry";

/**
 * Hmotnostní rozsah se u každého pravidla drží toho, o kom SPC mluví.
 * Adrenalin je jediný, jehož citace zmiňuje novorozence výslovně, proto
 * jako jediný sahá pod tři kilogramy.
 */
const RULES: readonly { id: DosingRuleId; minKg: number; maxKg: number; stepKg: number }[] = [
  { id: "adrenalinResuscitace", minKg: 2.5, maxKg: 5, stepKg: 0.1 },
  // PARALEN 125 mg jsou tablety; tabulka v SPC začíná na 9 kg.
  { id: "paracetamolDeti", minKg: 9, maxKg: 12, stepKg: 0.5 },
  { id: "ibuprofenBaby", minKg: 5, maxKg: 12, stepKg: 0.5 },
  { id: "ceftriaxonDeti", minKg: 3.5, maxKg: 12, stepKg: 0.5 },
];

/**
 * K4 — dávka na jedno podání u nejmenších pacientů.
 *
 * Řády jsou tu jiné než u dospělého: adrenalin vychází na setiny
 * miligramu a chyba o desetinu se v čísle skoro nepozná. Proto se dávka
 * počítá zvlášť a bez převodu na objem — ten přijde až v jiné šabloně.
 */
export const K4 = register({
  id: "K4",
  category: "pediatrie",
  source: RULES.map(({ id }) => dosingSource(id)),

  generate(rng, difficulty) {
    const choice = rng.pick(RULES);
    const rule = dosingRule(choice.id);
    const range = rule.single;
    if (!range) throw new Error(`Pravidlo ${choice.id} nemá dávku na jedno podání.`);

    const weightKg = difficulty === 1
      ? rng.step(choice.minKg, choice.maxKg, Math.max(choice.stepKg, 0.5) * 2)
      : rng.step(choice.minKg, choice.maxKg, choice.stepKg);
    const perKg = difficulty === 1
      ? range.min
      // U adrenalinu je celé rozmezí 0,01–0,03 mg/kg, takže krok musí být
      // setina miligramu — jemnější dávka by po zaokrouhlení na tři
      // desetinná místa přestala jít zapsat.
      : rng.step(range.min, range.max, range.max - range.min <= 0.02 ? 0.01 : 5);

    return {
      ruleId: choice.id,
      productName: rule.product,
      substance: rule.substance,
      code: rule.suklCode,
      weightKg,
      perKg,
      unit: range.unit,
    } satisfies Vars;
  },

  solve(vars): Solution {
    const weightKg = Number(vars.weightKg);
    const perKg = Number(vars.perKg);
    const doseMg = weightBasedDose(perKg, weightKg);

    return {
      value: doseMg,
      steps: [
        given(q(weightKg, "kg", 1), `${tex(perKg, 3)}\\ \\mathrm{mg/kg}`),
        formula("D = d_{kg} \\times m"),
        substitute(`${q(perKg, "mg/kg", 3)} \\times ${q(weightKg, "kg", 1)}`, q(doseMg, "mg", 3)),
        result(doseMg, "mg", 3),
      ],
      roundingNoteKey: "zaokrouhleniDavka",
    };
  },

  answer(_vars, solution) {
    const tolerance = tolerances.intermediate();
    return { unit: "mg", tolerance, decimals: tolerances.decimalsFor(solution.value, tolerance, 3) };
  },
});
