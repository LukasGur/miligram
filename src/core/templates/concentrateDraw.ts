import { concentrationAllowed, DILUTION_RULES, dilutionRuleFor, dilutionSource, doseAllowed, type DilutionRule } from "../products/dilution";
import type { Rng } from "../random";
import type { Difficulty, Source, Vars } from "../types";

/**
 * Kolik koncentrátu se do ředění natáhne a do čeho.
 *
 * Dřív se objem koncentrátu dopočítal z náhodného poměru ředění, a tak
 * vycházelo 25 ml Taxoteru (25 lahviček docetaxelu) nebo 300 ml 8,4%
 * bikarbonátu. Teď se vychází z toho, co na oddělení opravdu leží: ze
 * síly a balení podle SÚKL. Natahuje se nejvýš tři lahvičky a nejvýš
 * {@link MAX_DRAW_ML} ml (cytostatika podle pravidla víc). Teprve k tomu
 * se vybere objem, do kterého se ředí.
 *
 * Výsledná koncentrace, objem i množství léku musí odpovídat SPC
 * (`products/dilution.ts`).
 */
export const MAX_DRAW_ML = 40;

/** Nejvíc lahviček, které se do jednoho ředění natahují. */
const MAX_VIALS = 3;

/** Ředí se aspoň v poměru 1 : 4 — jinak by nešlo o ředění k podání. */
const MIN_DILUTION = 4;

/** Přípravek tak, jak ho šablona ukáže v zadání. */
export type DilutionProduct = { code: string; name: string; substance: string };

/** Nejvíc, kolik se z přípravku do jednoho ředění natáhne. */
function maxDrawMl(rule: DilutionRule): number {
  const largest = Math.max(...rule.vialsMl);
  return Math.min(largest * (rule.maxVials ?? MAX_VIALS), rule.maxDrawMl ?? MAX_DRAW_ML);
}

/** Natažené objemy, které připadají v úvahu: na první úrovni celé lahvičky. */
function drawOptionsMl(rule: DilutionRule, difficulty: Difficulty): number[] {
  const max = maxDrawMl(rule);
  if (difficulty === 1) {
    const whole = new Set<number>();
    for (const vial of rule.vialsMl) {
      for (let count = 1; count <= (rule.maxVials ?? MAX_VIALS); count += 1) {
        const volume = Number((count * vial).toFixed(1));
        if (volume <= max + 1e-9) whole.add(volume);
      }
    }
    return [...whole].sort((a, b) => a - b);
  }
  const options: number[] = [];
  for (let volume = 0.5; volume <= max + 1e-9; volume += 0.5) options.push(Number(volume.toFixed(1)));
  return options;
}

export type SpcDilution = {
  product: DilutionProduct;
  stockConcentration: number;
  drawnMl: number;
  targetVolumeMl: number;
  targetConcentration: number;
};

/**
 * Všechna ředění, která SPC dovoluje: natažený objem z balení, objem
 * z SPC (nebo z běžných vaků, když ho SPC neuvádí), koncentrace a dávka
 * v mezích a koncentrace zapsatelná na tři platné číslice beze zbytku.
 * Jinak by zaokrouhlená koncentrace v zadání dávala odpověď typu 33,51 ml
 * místo 33,5 ml.
 */
export function spcDilutions(rule: DilutionRule, difficulty: Difficulty, volumes: readonly number[]): SpcDilution[] {
  const options = dilutionsFrom(rule, drawOptionsMl(rule, difficulty), volumes);
  if (options.length > 0 || difficulty !== 1) return options;
  // Celá lahvička je někdy víc než dávka (topotekan 4 mg, dávka do 3 mg);
  // na první úrovni se pak natahují celé mililitry.
  return dilutionsFrom(rule, Array.from({ length: Math.floor(maxDrawMl(rule)) }, (_, i) => i + 1), volumes);
}

function dilutionsFrom(rule: DilutionRule, draws: readonly number[], volumes: readonly number[]): SpcDilution[] {
  const product = { code: rule.suklCode, name: rule.name, substance: rule.substance };
  const stockConcentration = rule.mgPerMlStock;
  const out: SpcDilution[] = [];
  for (const drawnMl of draws) {
    for (const targetVolumeMl of rule.totalVolumesMl ?? volumes) {
      if (targetVolumeMl < drawnMl * (rule.minDilution ?? MIN_DILUTION)) continue;
      const exact = (stockConcentration * drawnMl) / targetVolumeMl;
      const targetConcentration = Number(exact.toPrecision(3));
      if (Math.abs(targetConcentration - exact) > 1e-9 * Math.max(1, exact)) continue;
      if (!concentrationAllowed(rule, exact)) continue;
      if (!doseAllowed(rule, stockConcentration * drawnMl)) continue;
      out.push({ product, stockConcentration, drawnMl, targetVolumeMl, targetConcentration });
    }
  }
  return out;
}

/**
 * Ředění pro úlohu: nejdřív přípravek (každý má stejnou šanci, ať ho SPC
 * dovoluje ředit jakkoli široce), pak jedno z jeho dovolených ředění.
 */
export function pickSpcDilution(rng: Rng, difficulty: Difficulty, volumes: readonly number[]): SpcDilution {
  const usable = DILUTION_RULES.map((rule) => spcDilutions(rule, difficulty, volumes)).filter((options) => options.length > 0);
  return rng.pick(rng.pick(usable));
}

/** Citace SPC s výslednou koncentrací k příkladu. */
export function dilutionSourceFor(vars: Vars): Source[] {
  const rule = dilutionRuleFor(String(vars.code));
  return rule ? [dilutionSource(rule)] : [];
}
