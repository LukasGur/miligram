import { dosingRule, dosingSource, liquidPresentationOf } from "../products/dosing";
import { syringeFor } from "../devices";
import * as tolerances from "../tolerances";
import type { Solution, Source, Vars } from "../types";
import { formula, frac, given, q, result, substitute, tex } from "./helpers";
import { ISO_7886, register } from "./registry";

const RULE = "amoxicilinKlavulanat" as const;

/**
 * SPC Augmentinu si výpočet objemu odvozuje samo a rovnou v mililitrech.
 * Je to tentýž vztah jako v K1, jen zapsaný jedním zlomkem — a právě to
 * je na něm k naučení: ve zlomku je počet dílčích dávek ve jmenovateli,
 * takže se dvě dělení snadno slijí do jednoho.
 */
const SPC_FORMULA: Source = {
  citation:
    "SÚKL, SPC přípravku Augmentin 400 mg/5 ml + 57 mg/5 ml prášek pro perorální suspenzi, bod 4.2: " +
    "„Dávka (ml) podaná dvakrát denně = [doporučená dávka amoxicilinu (mg/kg/den) × tělesná " +
    "hmotnost (kg)] / [rekonstituovaná suspenze amoxicilinu (mg/ml) × 2 (rozdělené dávky)]. " +
    "Pro tento výpočet se vyžaduje pouze zohlednění složky amoxicilinu.“",
  url: "https://opendata.sukl.cz/?q=katalog/spc-souhrn-udaju-o-lecivem-pripravku-summary-product-characteristics",
  suklCode: "0285509",
  verifiedAt: "2026-09-03",
};

/**
 * K3 — objem podle vzorce, který má přípravek ve svém SPC.
 *
 * Kombinovaný přípravek má na obalu dvě čísla (400 mg/5 ml + 57 mg/5 ml)
 * a do výpočtu vstupuje jen amoxicilinová složka. SPC to říká výslovně;
 * kdo počítá s oběma, dostane objem menší, než má být.
 */
export const K3 = register({
  id: "K3",
  category: "pediatrie",
  source: [dosingSource(RULE), SPC_FORMULA, ISO_7886],

  generate(rng, difficulty) {
    const rule = dosingRule(RULE);
    const presentation = liquidPresentationOf(RULE);
    const range = rule.daily;
    if (!range) throw new Error(`Pravidlo ${RULE} nemá denní rozmezí.`);

    // SPC uvádí tabulku po celých kilogramech, na první úrovni je proto
    // hmotnost celé číslo — příklad jde porovnat přímo s tabulkou.
    const weightKg = difficulty === 1 ? rng.step(10, 30, 2) : rng.step(6, 39, difficulty === 2 ? 1 : 0.5);
    const mgPerKgPerDay = difficulty === 1 ? range.min : rng.step(range.min, range.max, 5);

    return {
      productName: rule.product,
      code: rule.suklCode,
      strengthMg: presentation.strengthMg,
      referenceMl: presentation.referenceMl,
      concentration: presentation.strengthMg / presentation.referenceMl,
      dosesPerDay: 2,
      weightKg,
      mgPerKgPerDay,
    } satisfies Vars;
  },

  solve(vars): Solution {
    const weightKg = Number(vars.weightKg);
    const mgPerKgPerDay = Number(vars.mgPerKgPerDay);
    const concentration = Number(vars.concentration);
    const dosesPerDay = Number(vars.dosesPerDay);

    const numerator = mgPerKgPerDay * weightKg;
    const denominator = concentration * dosesPerDay;
    const volumeMl = numerator / denominator;

    return {
      value: volumeMl,
      steps: [
        given(q(weightKg, "kg", 1), `${tex(mgPerKgPerDay, 0)}\\ \\mathrm{mg/kg/den}`, q(concentration, "mg/ml", 0)),
        formula(
          `V = ${frac("\\text{@amoxicillinDose} \\times m", "\\text{@concentration} \\times \\text{@splitCount}")}`,
        ),
        substitute(
          `V = ${frac(`${tex(mgPerKgPerDay, 0)} \\times ${tex(weightKg, 1)}`, `${tex(concentration, 0)} \\times ${tex(dosesPerDay, 0)}`)}`,
        ),
        substitute(`V = ${frac(q(numerator, "mg", 1), q(denominator, "mg/ml", 0))}`),
        result(volumeMl, "ml", 1),
      ],
      roundingNoteKey: "zaokrouhleniStrikacka",
    };
  },

  answer(_vars, solution) {
    return {
      unit: "ml",
      tolerance: tolerances.syringeVolume(Math.min(solution.value, 50)),
      decimals: (syringeFor(Math.min(solution.value, 50)) ?? 50) <= 2 ? 2 : 1,
    };
  },
});
