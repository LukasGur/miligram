import type { Tolerance } from "./answer";
import { PUMP_FLOW_ACCURACY, syringeToleranceMl } from "./devices";

/**
 * Tolerance odvozené z přesnosti prostředku, kterým se odpověď podává.
 *
 * Úvaha: nemá smysl vymáhat po uživateli víc přesnosti, než kolik jí umí
 * doručit stříkačka nebo pumpa. Čísla pocházejí z norem citovaných
 * v devices.ts; volba použít je jako toleranci odpovědi je návrhová.
 */

/** Objem odměřovaný stříkačkou — tolerance podle ISO 7886-1. */
export function syringeVolume(volumeMl: number): Tolerance {
  return { kind: "absolute", value: syringeToleranceMl(volumeMl) };
}

/** Rychlost nastavovaná na pumpě — přesnost průtoku podle IEC/EN 60601-2-24. */
export function pumpRate(): Tolerance {
  return { kind: "relative", value: PUMP_FLOW_ACCURACY };
}

/**
 * Kapky za minutu. Půl kapky proto, že u přesné poloviny je zaokrouhlení
 * nahoru i dolů obhajitelné a výrobci se v něm neshodnou.
 */
export function drops(): Tolerance {
  return { kind: "absolute", value: 0.5 };
}

/** Počet tablet, ampulí nebo lahviček — dělitelnost je daná, ne odhadovaná. */
export function countable(): Tolerance {
  return { kind: "exact" };
}

/**
 * Mezivýsledek, který se nikam nenastavuje — hmotnost, látkové množství,
 * povrch těla, clearance. Jediná chyba, která tu může vzniknout, je
 * zaokrouhlování v průběhu výpočtu.
 */
export function intermediate(): Tolerance {
  return { kind: "relative", value: 0.01 };
}
