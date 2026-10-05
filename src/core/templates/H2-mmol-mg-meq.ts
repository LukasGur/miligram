import { electrolyte, electrolyteSource, ELECTROLYTE_LIST, MOLAR_MASS_LIST } from "../products/electrolytes";
import { massToMillimoles, millimolesToEquivalents, millimolesToMass } from "../units";
import * as tolerances from "../tolerances";
import type { AnswerUnit, Solution } from "../types";
import { formula, frac, given, intermediate, q, result, substitute } from "./helpers";
import { register } from "./registry";
import { packageLabel } from "../products/label";

/** Dvojmocné ionty — jen u nich se mmol a mEq číselně rozejdou. */
const DIVALENT = ELECTROLYTE_LIST.filter(([, item]) => item.valence > 1);

/**
 * H2 — látkové množství, hmotnost a ekvivalenty navzájem.
 *
 * U jednomocných iontů mmol a mEq splývají, takže se rozdíl mezi nimi
 * nedá ukázat jinak než na dvojmocném iontu. Třetí úroveň proto losuje
 * hořčík, kde je 1 mmol roven 2 mEq — a SPC to uvádí v obou jednotkách.
 */
export const H2 = register({
  id: "H2",
  category: "prevody",
  source: ELECTROLYTE_LIST.map(([id]) => electrolyteSource(id)),

  generate(rng, difficulty) {
    if (difficulty === 3) {
      const [id] = rng.pick(DIVALENT);
      const item = electrolyte(id);
      return {
        direction: "mmolToMeq",
        id,
        product: packageLabel(item.product),
        ion: item.ion,
        valence: item.valence,
        mmol: rng.step(2, 20, 0.5),
        molarMass: 0,
        // Obě větve nesou stejné klíče, ať má zadání stálý tvar.
        massMg: 0,
      };
    }

    const [id] = rng.pick(MOLAR_MASS_LIST);
    const item = electrolyte(id);
    const molarMass = item.molarMassGPerMol ?? 0;

    // Množství se losuje v milimolech a teprve z něj vzniká hmotnost,
    // aby ani jeden směr nevedl na číslo s nekonečným ocasem.
    const mmol = rng.step(1, difficulty === 1 ? 10 : 40, difficulty === 1 ? 1 : 0.5);
    return {
      direction: rng.int(0, 1) === 1 ? "massToMmol" : "mmolToMass",
      id,
      product: packageLabel(item.product),
      ion: item.ion,
      valence: item.valence,
      mmol,
      molarMass,
      massMg: millimolesToMass(mmol, molarMass),
    };
  },

  solve(vars): Solution {
    const mmol = Number(vars.mmol);

    if (vars.direction === "mmolToMeq") {
      const valence = Number(vars.valence);
      const mEq = millimolesToEquivalents(mmol, valence);
      return {
        value: mEq,
        steps: [
          given(q(mmol, "mmol", 2), `${String(vars.ion)},\\ z = ${valence}`),
          formula("n_{\\mathrm{ekv}} = n \\times z"),
          substitute(`${q(mmol, "mmol", 2)} \\times ${q(valence, "mEq/mmol", 0)}`, q(mEq, "mEq", 2)),
          result(mEq, "mEq", 2),
        ],
        roundingNoteKey: "zaokrouhleniMezivysledek",
      };
    }

    const molarMass = Number(vars.molarMass);
    /**
     * Molární hmotnost je v zadání v g/mol, počítá se s ní v mg/mmol.
     * Číslo je stejné, a právě proto se to plete: kdo vydělí miligramy
     * číslem 74,5 a výsledek vezme jako moly, vynásobí tisícem navíc.
     * Krok ukazuje, že mol i gram se dělí tisícem zároveň — zápisem úpravy
     * rovnice, jak se učí ve škole.
     */
    const molarMassStep = intermediate("molarniHmotnost", {
      formula:
        `\\begin{aligned} 1\\,\\mathrm{mol} &= ${q(molarMass, "g", 1)} \\quad \\big|\\ {:}\\,1000 \\\\ ` +
        `1\\,\\mathrm{mmol} &= ${q(molarMass, "mg", 1)} \\end{aligned}`,
      result: `M = ${q(molarMass, "g/mol", 1)} = ${q(molarMass, "mg/mmol", 1)}`,
    });

    if (vars.direction === "mmolToMass") {
      const massMg = millimolesToMass(mmol, molarMass);
      return {
        value: massMg,
        steps: [
          given(q(mmol, "mmol", 2), `M = ${q(molarMass, "g/mol", 1)}`),
          molarMassStep,
          formula("m = n \\times M"),
          substitute(`${q(mmol, "mmol", 2)} \\times ${q(molarMass, "mg/mmol", 1)}`, q(massMg, "mg", 2)),
          result(massMg, "mg", 2),
        ],
        roundingNoteKey: "zaokrouhleniMezivysledek",
      };
    }

    const massMg = Number(vars.massMg);
    const converted = massToMillimoles(massMg, molarMass);
    return {
      value: converted,
      steps: [
        given(q(massMg, "mg", 2), `M = ${q(molarMass, "g/mol", 1)}`),
        molarMassStep,
        formula(`n = ${frac("m", "M")}`),
        substitute(`n = ${frac(q(massMg, "mg", 2), q(molarMass, "mg/mmol", 1))}`, q(converted, "mmol", 2)),
        result(converted, "mmol", 2),
      ],
      roundingNoteKey: "zaokrouhleniMezivysledek",
    };
  },

  answer(vars, solution) {
    const unit: AnswerUnit =
      vars.direction === "mmolToMeq" ? "mEq" : vars.direction === "mmolToMass" ? "mg" : "mmol";
    const tolerance = tolerances.intermediate();
    return { unit, tolerance, decimals: tolerances.decimalsFor(solution.value, tolerance, 3) };
  },
});
