import { selectProducts, type Product } from "../products";
import type { Rng } from "../random";
import type { Difficulty } from "../types";

/**
 * Kolik koncentrátu se do ředění natáhne.
 *
 * Dřív se objem koncentrátu dopočítal z náhodného poměru ředění, a tak
 * vycházelo 25 ml Taxoteru (25 lahviček docetaxelu) nebo 300 ml 8,4%
 * bikarbonátu. Teď se vychází z toho, co na oddělení opravdu leží: ze
 * síly a balení podle SÚKL. Natahuje se nejvýš obsah jednoho balení,
 * nejvýš tři lahvičky a nejvýš {@link MAX_DRAW_ML} ml. Teprve k tomu se
 * vybere objem, do kterého se ředí.
 *
 * Nic dalšího se tu netvrdí — žádná dávka ani cílová koncentrace ze SPC.
 * Strop jen brání tomu, aby zadání předepsalo víc léku, než kolik ho
 * v balení vůbec je.
 */
export const MAX_DRAW_ML = 40;

/** Nejvíc lahviček, které se do jednoho ředění natahují. */
const MAX_VIALS = 3;

/** Ředí se aspoň v poměru 1 : 4 — jinak by nešlo o ředění k podání. */
const MIN_DILUTION = 4;

export function vialVolumeMl(product: Product): number {
  return product.packUnitVolumeMl ?? product.volumeMl ?? 1;
}

/** Nejvíc, kolik se z přípravku do jednoho ředění natáhne. */
export function maxDrawMl(product: Product): number {
  const vial = vialVolumeMl(product);
  const pack = vial * (product.packCount ?? 1);
  return Math.min(pack, vial * MAX_VIALS, MAX_DRAW_ML);
}

/**
 * Koncentráty pro úlohy na ředění. Jen ty, ze kterých jde natáhnout aspoň
 * půl mililitru — z menšího objemu se úloha s krokem 0,5 ml nesestaví.
 */
export function dilutableConcentrates(minStrength: number): Product[] {
  return selectProducts({ kind: "concentrate", strengthUnit: "mg", minStrength }).filter(
    (product) => maxDrawMl(product) >= 0.5,
  );
}

/**
 * Natažený objem. Na první úrovni celé lahvičky (u velkých lahví kulatý
 * objem), výš po půl mililitru.
 */
export function drawVolumeMl(rng: Rng, product: Product, difficulty: Difficulty): number {
  const max = maxDrawMl(product);
  const vial = vialVolumeMl(product);
  if (difficulty === 1) {
    const whole = [1, 2, 3].map((count) => count * vial).filter((volume) => volume <= max);
    if (whole.length > 0) return rng.pick(whole);
    const round = [5, 10, 20, 40].filter((volume) => volume <= max);
    return round.length > 0 ? rng.pick(round) : max;
  }
  return rng.step(0.5, max, 0.5);
}

/** Objem, do kterého se ředí: z běžných objemů, aspoň čtyřnásobek nataženého. */
export function carrierVolumeMl(rng: Rng, drawnMl: number, volumes: readonly number[]): number {
  const fitting = volumes.filter((volume) => volume >= drawnMl * MIN_DILUTION);
  return fitting.length > 0 ? rng.pick(fitting) : volumes[volumes.length - 1];
}

/**
 * Natažený objem, objem ředění a cílová koncentrace, která jde napsat
 * na tři platné číslice beze zbytku. Jinak by zaokrouhlená koncentrace
 * v zadání dávala odpověď typu 33,51 ml místo 33,5 ml.
 */
export function dilutionTarget(
  rng: Rng,
  product: Product,
  stockConcentration: number,
  difficulty: Difficulty,
  volumes: readonly number[],
): { drawnMl: number; targetVolumeMl: number; targetConcentration: number } {
  let fallback: { drawnMl: number; targetVolumeMl: number; targetConcentration: number } | null = null;
  for (let tries = 0; tries < 24; tries += 1) {
    const drawnMl = drawVolumeMl(rng, product, difficulty);
    const targetVolumeMl = carrierVolumeMl(rng, drawnMl, volumes);
    const exact = (stockConcentration * drawnMl) / targetVolumeMl;
    const targetConcentration = Number(exact.toPrecision(3));
    const candidate = { drawnMl, targetVolumeMl, targetConcentration };
    if (Math.abs(targetConcentration - exact) < 1e-9 * Math.max(1, exact)) return candidate;
    fallback ??= candidate;
  }
  return fallback!;
}
