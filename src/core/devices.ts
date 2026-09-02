/**
 * Specifikace zdravotnických prostředků, kterými se odpověď reálně podává.
 *
 * Slouží ke dvěma věcem:
 *  1. kapkové faktory pro výpočet kapek za minutu,
 *  2. odvození tolerance odpovědi.
 *
 * K bodu 2 poctivě: normy níže popisují **přesnost prostředku**, ne to, jak
 * přesně má student počítat. Rozhodnutí odvodit toleranci odpovědi právě
 * z přesnosti prostředku je návrhové — nechceme po uživateli víc přesnosti,
 * než kolik jí umí doručit stříkačka nebo pumpa. Čísla jsou doložená,
 * ta úvaha je naše.
 */

export type DeviceSource = {
  citation: string;
  url?: string;
  verifiedAt: string;
};

/* -------------------------------------------------------------------------
   Infuzní sety
   ---------------------------------------------------------------------- */

export const DROP_FACTOR_SOURCE: DeviceSource = {
  citation:
    "B. Braun Medical Inc., Gravity Flow Rate Drip Chart, dokument IV109 3/20: " +
    "„Confirm tubing set drip rate on set package, i.e., 10, 15, 20, or 60 drops/mL.“",
  url: "https://www.ismp.org/sites/default/files/attachments/2020-04/BBraun-flow-rate-drip-chart-04-03-2020.pdf",
  verifiedAt: "2026-09-03",
};

/** Kapkové faktory, které výrobce uvádí na obalu setu. */
export const DROP_FACTORS = [10, 15, 20, 60] as const;
export type DropFactor = (typeof DROP_FACTORS)[number];

/** Set s faktorem 60 gtt/ml — u něj se počet kapek číselně rovná ml/h. */
export const MICRODRIP_FACTOR: DropFactor = 60;

/* -------------------------------------------------------------------------
   Injekční stříkačky
   ---------------------------------------------------------------------- */

export const SYRINGE_SOURCE: DeviceSource = {
  citation:
    "ČSN EN ISO 7886-1, Sterilní injekční stříkačky pro jedno použití — " +
    "tolerance odměřeného objemu: do poloviny jmenovitého objemu " +
    "±(1,5 % jmenovitého objemu + 2 % odměřeného objemu), " +
    "od poloviny výše ±5 % odměřeného objemu.",
  url: "https://www.iso.org/standard/14835.html",
  verifiedAt: "2026-09-03",
};

/** Jmenovité objemy běžně dostupných stříkaček. */
export const SYRINGE_SIZES_ML = [1, 2, 5, 10, 20, 50] as const;

/** Nejmenší stříkačka, do které se objem vejde. Nad 50 ml se už neodměřuje. */
export function syringeFor(volumeMl: number): number | null {
  return SYRINGE_SIZES_ML.find((size) => volumeMl <= size) ?? null;
}

/**
 * Tolerance odměření podle ISO 7886-1. Vrací absolutní odchylku v ml.
 *
 * Norma dělí rozsah na polovině jmenovitého objemu: pod ní se k chybě
 * odměřeného objemu přičítá podíl jmenovitého, protože u málo naplněné
 * stříkačky váží mrtvý objem víc.
 */
export function syringeToleranceMl(volumeMl: number): number {
  const nominal = syringeFor(volumeMl);
  if (nominal === null) {
    throw new Error(`Objem ${volumeMl} ml se nevejde do žádné běžné stříkačky.`);
  }
  return volumeMl < nominal / 2
    ? 0.015 * nominal + 0.02 * volumeMl
    : 0.05 * volumeMl;
}

/* -------------------------------------------------------------------------
   Infuzní pumpy
   ---------------------------------------------------------------------- */

export const PUMP_SOURCE: DeviceSource = {
  citation:
    "B. Braun Perfusor Space, technické údaje: rychlost 0,01–99,99 ml/h " +
    "po krocích 0,01 ml/h a 100,0–999,9 ml/h po krocích 0,1 ml/h; " +
    "přesnost průtoku ±2 % podle IEC/EN 60601-2-24.",
  url: "https://www.bbraun.com/en/products/b/perfusor-space.html",
  verifiedAt: "2026-09-03",
};

/** Nejmenší krok, na který jde pumpa nastavit. */
export function pumpStepMlPerHour(rateMlPerHour: number): number {
  return rateMlPerHour < 100 ? 0.01 : 0.1;
}

/** Přesnost průtoku podle IEC/EN 60601-2-24, jako podíl nastavené rychlosti. */
export const PUMP_FLOW_ACCURACY = 0.02;
