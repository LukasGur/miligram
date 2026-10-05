import { electrolyte, electrolyteSource, ELECTROLYTE_LIST, MOLAR_MASS_LIST } from "../products/electrolytes";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { formula, frac, given, intermediate, q, result, substitute } from "./helpers";
import { register } from "./registry";
import { packageLabel } from "../products/label";

/** Kolikrát se koncentrát naředí, než se koncentrace udává v mmol/l. */
const DILUTIONS = {
  1: [1, 10] as const,
  2: [2, 5, 10, 20] as const,
  3: [4, 8, 25, 40] as const,
};

/** Soli, u kterých je známá molární hmotnost i to, na jaké ionty se rozpadají. */
const SALT_LIST = MOLAR_MASS_LIST.filter(([, item]) => item.salt !== undefined);

/** „Na+“ → Na⁺ v sazbě. */
function ionTex(ion: string): string {
  return `\\mathrm{${ion.replace(/(\d*[+-])$/, "^{$1}")}}`;
}

/**
 * H6 — z hmotnostní koncentrace na látkovou.
 *
 * Laboratoř hlásí ionty v mmol/l, obal roztoku je značený v mg/ml nebo
 * v procentech. Most mezi nimi je molární hmotnost, a ta musí být ze zdroje:
 * v tabulce jsou jen soli, u kterých ji SPC uvádí tak, že z něj plyne
 * beze zbytku (74,5 g/l = 1000 mmol/l).
 */
export const H6 = register({
  id: "H6",
  category: "prevody",
  source: MOLAR_MASS_LIST.map(([id]) => electrolyteSource(id)),

  generate(rng, difficulty) {
    const [id] = rng.pick(SALT_LIST);
    const item = electrolyte(id);
    const dilution = rng.pick(DILUTIONS[difficulty]);

    return {
      code: item.suklCode,
      productName: packageLabel(item.product),
      ion: item.ion,
      molarMass: item.molarMassGPerMol ?? 0,
      dilution,
      mgPerMl: Number((item.mgPerMl / dilution).toFixed(4)),
    } satisfies Vars;
  },

  solve(vars): Solution {
    const mgPerMl = Number(vars.mgPerMl);
    const molarMass = Number(vars.molarMass);
    const ion = String(vars.ion);
    const salt = ELECTROLYTE_LIST.find(([, item]) => item.suklCode === vars.code)?.[1].salt;
    if (!salt) throw new Error(`Přípravek ${String(vars.code)} nemá vyplněné složení soli.`);
    const ionsPerSalt = salt.ions.filter((i) => i === ion).length;

    // Nejdřív na gramy v litru, teprve pak dělení molární hmotností —
    // opačné pořadí přidává mezikrok, ve kterém se ztrácí řád.
    const gPerL = mgPerMl;
    // g/l ÷ g/mol dá mol/l. Převod na mmol/l je samostatný krok, protože
    // právě v něm se ztrácí tisícovka — kdo ho přeskočí, odpoví 0,05
    // místo 50, a postup mu musí ukázat, kde přesně.
    const molPerL = gPerL / molarMass;
    const saltMmolPerL = molPerL * 1000;
    const ionMmolPerL = saltMmolPerL * ionsPerSalt;

    return {
      value: ionMmolPerL,
      steps: [
        given(q(mgPerMl, "mg/ml", 3), `M = ${q(molarMass, "g/mol", 1)}`),
        intermediate("gramyNaLitr", { substituted: `${q(mgPerMl, "mg/ml", 3)} = ${q(gPerL, "g/l", 3)}` }),
        formula(`c_n = ${frac("c_m", "M")}`),
        substitute(`c_n = ${frac(q(gPerL, "g/l", 3), q(molarMass, "g/mol", 1))}`, q(molPerL, "mol/l", 4)),
        intermediate("naMilimoly", {
          formula: "1\\,\\mathrm{mol} = 1000\\,\\mathrm{mmol}",
          substituted: `${q(molPerL, "mol/l", 4)} \\times ${q(1000, "mmol/mol", 0)}`,
          result: q(saltMmolPerL, "mmol/l", 2),
        }),
        intermediate("disociace", {
          formula: `\\mathrm{${salt.formula}} \\to ${salt.ions.map(ionTex).join(" + ")}`,
          substituted: `c_{${ionTex(ion)}} = ${ionsPerSalt} \\times ${q(saltMmolPerL, "mmol/l", 2)}`,
          result: q(ionMmolPerL, "mmol/l", 2),
        }),
        result(ionMmolPerL, "mmol/l", 2),
      ],
      roundingNoteKey: "zaokrouhleniMezivysledek",
    };
  },

  answer(_vars, solution) {
    const tolerance = tolerances.intermediate();
    return { unit: "mmolPerL", tolerance, decimals: tolerances.decimalsFor(solution.value, tolerance, 2) };
  },
});
