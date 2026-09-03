/**
 * Výpočetní vzorce.
 *
 * Každá funkce je čistá, pracuje v základních jednotkách (mg, ml, min, kg)
 * a nezaokrouhluje — zaokrouhlení patří až do vrstvy zobrazení, protože
 * tolerance odpovědi se liší šablonu od šablony.
 *
 * Zdroje publikovaných vzorců jsou uvedené u jednotlivých funkcí a v celku
 * v docs/zdroje.md.
 */

function positive(value: number, name: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} musí být kladné konečné číslo, dostal jsem ${value}.`);
  }
  return value;
}

/* -------------------------------------------------------------------------
   Základní dávkování
   ---------------------------------------------------------------------- */

/**
 * Objem potřebný k podání dávky.
 *
 *   objem = (požadovaná dávka / dostupná síla) × objem balení
 *
 * Například 15 mg furosemidu z ampule 20 mg ve 2 ml → 1,5 ml.
 */
export function doseVolume(requiredMg: number, availableMg: number, availableMl: number): number {
  return (positive(requiredMg, "požadovaná dávka") / positive(availableMg, "dostupná síla")) *
    positive(availableMl, "objem balení");
}

/** Počet jednotek lékové formy (tablet, čípků, ampulí) pro danou dávku. */
export function unitsForDose(requiredMg: number, strengthMg: number): number {
  return positive(requiredMg, "požadovaná dávka") / positive(strengthMg, "síla jednotky");
}

/** Množství léčivé látky v daném objemu roztoku o známé koncentraci. */
export function massInVolume(concentrationMgPerMl: number, volumeMl: number): number {
  return positive(concentrationMgPerMl, "koncentrace") * positive(volumeMl, "objem");
}

/* -------------------------------------------------------------------------
   Dávkování podle hmotnosti a povrchu těla
   ---------------------------------------------------------------------- */

export function weightBasedDose(mgPerKg: number, weightKg: number): number {
  return positive(mgPerKg, "dávka na kilogram") * positive(weightKg, "hmotnost");
}

/** Denní dávka rozdělená do několika podání. */
export function dividedDose(mgPerKgPerDay: number, weightKg: number, dosesPerDay: number): number {
  return weightBasedDose(mgPerKgPerDay, weightKg) / positive(dosesPerDay, "počet dávek");
}

/**
 * Povrch těla podle Mostellera.
 *
 *   BSA [m²] = √( (výška[cm] × hmotnost[kg]) / 3600 )
 *
 * Mosteller RD. N Engl J Med 1987;317(17):1098.
 */
export function bodySurfaceArea(heightCm: number, weightKg: number): number {
  return Math.sqrt((positive(heightCm, "výška") * positive(weightKg, "hmotnost")) / 3600);
}

export function bsaBasedDose(mgPerM2: number, bsaM2: number): number {
  return positive(mgPerM2, "dávka na m²") * positive(bsaM2, "povrch těla");
}

/* -------------------------------------------------------------------------
   Ředění a koncentrace
   ---------------------------------------------------------------------- */

/**
 * Objem koncentrátu potřebný k přípravě roztoku o cílové koncentraci.
 * Z rovnice C₁V₁ = C₂V₂ pro neznámé V₁.
 */
export function volumeOfStock(c1: number, c2: number, v2: number): number {
  positive(c1, "výchozí koncentrace");
  positive(c2, "cílová koncentrace");
  positive(v2, "cílový objem");
  if (c2 > c1) throw new Error("Cílová koncentrace nesmí být vyšší než výchozí — ředěním se nekoncentruje.");
  return (c2 * v2) / c1;
}

/** Výsledný objem po naředění známého objemu koncentrátu na cílovou koncentraci. */
export function volumeAfterDilution(c1: number, v1: number, c2: number): number {
  positive(c2, "cílová koncentrace");
  return (positive(c1, "výchozí koncentrace") * positive(v1, "objem koncentrátu")) / c2;
}

/**
 * Výsledná koncentrace roztoku o daném celkovém objemu, do kterého se
 * přidalo jedno nebo víc množství léčivé látky.
 *
 * Pokrývá dva případy jedním vztahem: naředění koncentrátu (jedna složka)
 * i smíchání dvou roztoků různé koncentrace (dvě složky). V obou jde
 * o totéž — hmotnost se sečte, objem se ustálí na cílovém.
 */
export function mixedConcentration(
  parts: readonly { concentration: number; volumeMl: number }[],
  totalVolumeMl: number,
): number {
  positive(totalVolumeMl, "celkový objem");
  if (parts.length === 0) throw new Error("Roztok musí mít aspoň jednu složku.");

  const mass = parts.reduce((sum, part) => {
    positive(part.volumeMl, "objem složky");
    if (part.concentration < 0) throw new Error("Koncentrace složky nemůže být záporná.");
    return sum + part.concentration * part.volumeMl;
  }, 0);
  return mass / totalVolumeMl;
}

/**
 * Procentní vyjádření na poměrové a zpět.
 *
 * 1 % je 1 g ve 100 ml, což je totéž co 1:100. Adrenalin 1:1000 je proto
 * roztok 0,1 %.
 */
export function percentToRatio(percent: number): number {
  return 100 / positive(percent, "procento");
}

export function ratioToPercent(partsOfSolution: number): number {
  return 100 / positive(partsOfSolution, "poměr");
}

/**
 * Procentní roztok na mg/ml.
 *
 * 1 % znamená 1 g ve 100 ml, tedy 10 mg/ml. Glukóza 40 % = 400 mg/ml.
 */
export function percentToMgPerMl(percent: number): number {
  return positive(percent, "procento") * 10;
}

/**
 * Poměrové ředění na mg/ml.
 *
 * Zápis 1:1000 znamená 1 g látky v 1000 ml, tedy 1 mg/ml — takto je
 * definovaný adrenalin 1:1000.
 */
export function ratioToMgPerMl(partsOfSolution: number): number {
  return 1000 / positive(partsOfSolution, "poměr");
}

/* -------------------------------------------------------------------------
   Rekonstituce
   ---------------------------------------------------------------------- */

/**
 * Koncentrace po rozpuštění lyofilizátu.
 *
 * Prášek sám zabírá objem, takže výsledný objem je objem rozpouštědla plus
 * objem látky. U některých přípravků je zanedbatelný, u jiných ne — proto
 * je parametr povinný a volající musí vědomě zadat 0.
 */
export function reconstitutedConcentration(
  massMg: number,
  diluentMl: number,
  displacementMl: number,
): number {
  positive(massMg, "množství látky");
  positive(diluentMl, "objem rozpouštědla");
  if (displacementMl < 0) throw new Error("Objem látky nemůže být záporný.");
  return massMg / (diluentMl + displacementMl);
}

/** Nejmenší objem, ve kterém smí být dávka podána, aby se nepřekročil limit koncentrace. */
export function minimumDiluentVolume(massMg: number, maxConcentrationMgPerMl: number): number {
  return positive(massMg, "množství látky") / positive(maxConcentrationMgPerMl, "maximální koncentrace");
}

/* -------------------------------------------------------------------------
   Rychlost infuze
   ---------------------------------------------------------------------- */

/** Rychlost infuze v ml/h z objemu a času. */
export function infusionRateMlPerHour(volumeMl: number, timeMinutes: number): number {
  // Násobek 60 jde záměrně před dělení: (500/240)*60 vyjde 125,00000000000001,
  // kdežto (500*60)/240 přesně 125. U výsledků, které se porovnávají
  // s tolerancí, se takové zbytky sčítají přes mezikroky.
  return (positive(volumeMl, "objem") * 60) / positive(timeMinutes, "čas");
}

/** Doba dokapání v minutách při dané rychlosti. */
export function infusionTimeMinutes(volumeMl: number, rateMlPerHour: number): number {
  return (positive(volumeMl, "objem") * 60) / positive(rateMlPerHour, "rychlost");
}

/**
 * Počet kapek za minutu.
 *
 *   kapky/min = (objem[ml] × kapkový faktor[gtt/ml]) / čas[min]
 */
export function dropsPerMinute(volumeMl: number, dropFactor: number, timeMinutes: number): number {
  return (positive(volumeMl, "objem") * positive(dropFactor, "kapkový faktor")) /
    positive(timeMinutes, "čas");
}

/* -------------------------------------------------------------------------
   Kontinuální infuze vazoaktivních látek
   ---------------------------------------------------------------------- */

/**
 * µg/kg/min → ml/h.
 *
 *   ml/h = (dávka[µg/kg/min] × hmotnost[kg] × 60) / (koncentrace[mg/ml] × 1000)
 *
 * Násobek 60 převádí minuty na hodiny, dělení tisícem mikrogramy na miligramy.
 */
export function microgramsPerKgMinToMlPerHour(
  ugPerKgMin: number,
  weightKg: number,
  concentrationMgPerMl: number,
): number {
  positive(ugPerKgMin, "dávka");
  positive(weightKg, "hmotnost");
  positive(concentrationMgPerMl, "koncentrace");
  return (ugPerKgMin * weightKg * 60) / (concentrationMgPerMl * 1000);
}

export function mlPerHourToMicrogramsPerKgMin(
  mlPerHour: number,
  weightKg: number,
  concentrationMgPerMl: number,
): number {
  positive(mlPerHour, "rychlost");
  positive(weightKg, "hmotnost");
  positive(concentrationMgPerMl, "koncentrace");
  return (mlPerHour * concentrationMgPerMl * 1000) / (weightKg * 60);
}

/** µg/min → ml/h. Noradrenalin se u dospělých dávkuje bez přepočtu na hmotnost. */
export function microgramsPerMinToMlPerHour(ugPerMin: number, concentrationMgPerMl: number): number {
  positive(ugPerMin, "dávka");
  positive(concentrationMgPerMl, "koncentrace");
  return (ugPerMin * 60) / (concentrationMgPerMl * 1000);
}

/* -------------------------------------------------------------------------
   Funkce ledvin a onkologie
   ---------------------------------------------------------------------- */

/** Přepočet kreatininu mezi µmol/l (české laboratoře) a mg/dl (původní vzorec). */
export const CREATININE_MGDL_PER_UMOLL = 1 / 88.4;

/**
 * Clearance kreatininu podle Cockcrofta a Gaulta.
 *
 *   CrCl [ml/min] = ((140 − věk) × hmotnost[kg]) / (72 × kreatinin[mg/dl])
 *   u žen × 0,85
 *
 * Cockcroft DW, Gault MH. Nephron 1976;16(1):31–41.
 *
 * České laboratoře hlásí kreatinin v µmol/l, proto se hodnota nejdřív
 * převede (1 mg/dl = 88,4 µmol/l). Konstanty 1,23 a 1,04, které se často
 * uvádějí jako „SI verze“ vzorce, jsou jen důsledek tohoto převodu —
 * počítáme je, místo abychom je opisovali.
 */
export function creatinineClearance(options: {
  ageYears: number;
  weightKg: number;
  creatinineUmolPerL: number;
  female: boolean;
}): number {
  const { ageYears, weightKg, creatinineUmolPerL, female } = options;
  positive(ageYears, "věk");
  positive(weightKg, "hmotnost");
  positive(creatinineUmolPerL, "kreatinin");
  if (ageYears >= 140) throw new Error("Vzorec platí jen pro věk pod 140 let.");

  const creatinineMgPerDl = creatinineUmolPerL * CREATININE_MGDL_PER_UMOLL;
  const base = ((140 - ageYears) * weightKg) / (72 * creatinineMgPerDl);
  return female ? base * 0.85 : base;
}

/**
 * Dávka karboplatiny podle Calverta.
 *
 *   dávka[mg] = cílová AUC[mg/ml·min] × (GFR[ml/min] + 25)
 *
 * Calvert AH et al. J Clin Oncol 1989;7(11):1748–56; uvedeno rovněž
 * v SPC přípravku Carboplatin Accord.
 */
export function calvertDose(targetAuc: number, gfrMlPerMin: number): number {
  positive(targetAuc, "cílová AUC");
  positive(gfrMlPerMin, "GFR");
  return targetAuc * (gfrMlPerMin + 25);
}
