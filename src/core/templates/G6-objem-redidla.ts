import { vialContentMg } from "../products";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { formula, frac, given, intermediate, q, result, substitute } from "./helpers";
import { register, SUKL_DLP } from "./registry";
import { realisticDilution } from "./perfusor";

/**
 * G6 — kolik ředidla natáhnout.
 *
 * Ampule už jsou ve stříkačce a zbytek do celkového objemu doplní
 * fyziologický roztok. Odpověď je rozdíl, ne celkový objem — stejná
 * past jako u D6, jen v perfuzoru.
 */
export const G6 = register({
  id: "G6",
  category: "vazoaktivni",
  source: SUKL_DLP,

  /**
   * Obtížnost roste počtem kroků. Na první úrovni je počet ampulí daný,
   * na druhé celkové množství léku v mg (kolik ml to je, se dopočítá
   * z koncentrace ampule), na třetí cílová koncentrace ve stříkačce
   * (nejdřív kolik mg, pak kolik ml, pak ředidlo). Dřív byly všechny
   * tři úrovně stejné.
   */
  generate(rng, difficulty) {
    const { product, syringeMl, ampoules, totalMg, concentrationMgPerMl } = realisticDilution(rng);
    const ampouleMl = product.packUnitVolumeMl ?? product.volumeMl ?? 1;

    return {
      code: product.code,
      productName: product.name,
      substance: product.substance,
      ampouleMg: vialContentMg(product),
      ampouleMl,
      ampoules,
      syringeMl,
      totalMg,
      targetMgPerMl: Number(concentrationMgPerMl.toPrecision(6)),
      form: difficulty === 1 ? "ampoules" : difficulty === 2 ? "mass" : "concentration",
    } satisfies Vars;
  },

  solve(vars): Solution {
    const ampouleMl = Number(vars.ampouleMl);
    const ampouleMg = Number(vars.ampouleMg);
    const syringeMl = Number(vars.syringeMl);
    const stockMgPerMl = ampouleMg / ampouleMl;

    const fromMass = vars.form === "mass" || vars.form === "concentration";
    const totalMg = vars.form === "concentration" ? Number(vars.targetMgPerMl) * syringeMl : Number(vars.totalMg);
    const drugMl = fromMass ? totalMg / stockMgPerMl : ampouleMl * Number(vars.ampoules);
    const diluentMl = syringeMl - drugMl;

    const steps = [];
    if (vars.form === "concentration") {
      steps.push(
        given(q(Number(vars.targetMgPerMl), "mg/ml", 3), `V_{\\text{@total}} = ${q(syringeMl, "ml", 0)}`, `${q(ampouleMg, "mg", 1)} / ${q(ampouleMl, "ml", 1)}`),
        intermediate("potrebneMnozstvi", {
          substituted: `m = ${q(Number(vars.targetMgPerMl), "mg/ml", 3)} \\times ${q(syringeMl, "ml", 0)}`,
          result: q(totalMg, "mg", 1),
        }),
      );
    } else if (vars.form === "mass") {
      steps.push(given(q(totalMg, "mg", 1), `V_{\\text{@total}} = ${q(syringeMl, "ml", 0)}`, `${q(ampouleMg, "mg", 1)} / ${q(ampouleMl, "ml", 1)}`));
    } else {
      steps.push(given(`${Number(vars.ampoules)} \\times ${q(ampouleMl, "ml", 1)}`, `V_{\\text{@total}} = ${q(syringeMl, "ml", 0)}`));
    }

    if (fromMass) {
      steps.push(
        intermediate("koncentrace", {
          substituted: `c = ${frac(q(ampouleMg, "mg", 1), q(ampouleMl, "ml", 1))}`,
          result: q(stockMgPerMl, "mg/ml", 2),
        }),
        intermediate("objemLeciva", {
          substituted: `V_{\\text{@drug}} = ${frac(q(totalMg, "mg", 1), q(stockMgPerMl, "mg/ml", 2))}`,
          result: q(drugMl, "ml", 1),
        }),
      );
    } else {
      steps.push(
        intermediate("objemLeciva", {
          substituted: `V_{\\text{@drug}} = ${Number(vars.ampoules)} \\times ${q(ampouleMl, "ml", 1)}`,
          result: q(drugMl, "ml", 1),
        }),
      );
    }

    steps.push(
      formula(`V_{\\text{@diluentShort}} = V_{\\text{@total}} - V_{\\text{@drug}}`),
      substitute(`V_{\\text{@diluentShort}} = ${q(syringeMl, "ml", 0)} - ${q(drugMl, "ml", 1)}`),
      result(diluentMl, "ml", 1),
    );

    return { value: diluentMl, steps, roundingNoteKey: "zaokrouhleniStrikacka" };
  },

  answer(_vars, solution) {
    const tolerance = tolerances.intermediate();
    return { unit: "ml", tolerance, decimals: tolerances.decimalsFor(solution.value, tolerance) };
  },
});
