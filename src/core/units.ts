/**
 * Jednotky a převody.
 *
 * Veškerá vnitřní aritmetika běží v základní jednotce každé veličiny
 * (mg, ml, kg, min). Převod na zobrazovanou jednotku se dělá až na konci,
 * aby se chyby zaokrouhlení nehromadily přes mezikroky.
 */

export const QUANTITIES = ["mass", "volume", "time", "amount", "activity", "length"] as const;
export type Quantity = (typeof QUANTITIES)[number];

export type UnitDef = {
  /** Symbol tak, jak se píše v českém a slovenském prostředí. */
  readonly symbol: string;
  readonly quantity: Quantity;
  /** Kolik základních jednotek je v jedné této jednotce. */
  readonly factor: number;
};

/** Základní jednotky: mg, ml, min, mmol, IU, cm. */
export const UNITS = {
  // hmotnost — základ mg
  ng: { symbol: "ng", quantity: "mass", factor: 1e-6 },
  µg: { symbol: "µg", quantity: "mass", factor: 1e-3 },
  mg: { symbol: "mg", quantity: "mass", factor: 1 },
  g: { symbol: "g", quantity: "mass", factor: 1e3 },
  kg: { symbol: "kg", quantity: "mass", factor: 1e6 },

  // objem — základ ml
  ml: { symbol: "ml", quantity: "volume", factor: 1 },
  l: { symbol: "l", quantity: "volume", factor: 1e3 },

  // čas — základ min
  s: { symbol: "s", quantity: "time", factor: 1 / 60 },
  min: { symbol: "min", quantity: "time", factor: 1 },
  h: { symbol: "h", quantity: "time", factor: 60 },
  den: { symbol: "den", quantity: "time", factor: 1440 },

  // látkové množství — základ mmol
  µmol: { symbol: "µmol", quantity: "amount", factor: 1e-3 },
  mmol: { symbol: "mmol", quantity: "amount", factor: 1 },
  mol: { symbol: "mol", quantity: "amount", factor: 1e3 },
  mEq: { symbol: "mEq", quantity: "amount", factor: 1 },

  // aktivita — základ IU
  IU: { symbol: "IU", quantity: "activity", factor: 1 },

  // délka — základ cm
  cm: { symbol: "cm", quantity: "length", factor: 1 },
  m: { symbol: "m", quantity: "length", factor: 100 },
} as const satisfies Record<string, UnitDef>;

export type Unit = keyof typeof UNITS;

/**
 * mEq a mmol mají u jednomocných iontů stejnou číselnou hodnotu, ale
 * u dvoj- a trojmocných ne. Převod mezi nimi proto vyžaduje mocenství
 * a nesmí projít obecnou funkcí convert().
 */
export function convert(value: number, from: Unit, to: Unit): number {
  const source = UNITS[from];
  const target = UNITS[to];
  if (source.quantity !== target.quantity) {
    throw new Error(`Nelze převést ${from} na ${to}: různé veličiny.`);
  }
  if ((from === "mEq") !== (to === "mEq")) {
    throw new Error("Převod mmol ↔ mEq vyžaduje mocenství iontu, použij convertEquivalents().");
  }
  return (value * source.factor) / target.factor;
}

/** mEq = mmol × mocenství. Pro K⁺ a Na⁺ (mocenství 1) jsou hodnoty shodné. */
export function millimolesToEquivalents(mmol: number, valence: number): number {
  if (valence <= 0) throw new Error("Mocenství musí být kladné.");
  return mmol * valence;
}

export function equivalentsToMillimoles(mEq: number, valence: number): number {
  if (valence <= 0) throw new Error("Mocenství musí být kladné.");
  return mEq / valence;
}

/** Hmotnost látky ↔ látkové množství přes molární hmotnost [g/mol]. */
export function massToMillimoles(mg: number, molarMassGPerMol: number): number {
  if (molarMassGPerMol <= 0) throw new Error("Molární hmotnost musí být kladná.");
  return mg / molarMassGPerMol;
}

export function millimolesToMass(mmol: number, molarMassGPerMol: number): number {
  if (molarMassGPerMol <= 0) throw new Error("Molární hmotnost musí být kladná.");
  return mmol * molarMassGPerMol;
}

/** Symbol jednotky pro zobrazení (pevný sufix u pole odpovědi). */
export function symbolOf(unit: Unit): string {
  return UNITS[unit].symbol;
}
