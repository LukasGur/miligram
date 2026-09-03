import type { Source } from "../types";

/**
 * Onkologické údaje z bodu 4.2 SPC karboplatiny.
 *
 * Calvertův vzorec je publikovaná práce, ale SPC ho přebírá i s tabulkou
 * cílových hodnot AUC a s pravidlem pro redukci úvodní dávky. Citujeme
 * proto obojí: původní práci za vzorec, SPC za čísla, která se do něj
 * dosazují a která by jinak byla odhad.
 */
const SPC_URL =
  "https://opendata.sukl.cz/?q=katalog/spc-souhrn-udaju-o-lecivem-pripravku-summary-product-characteristics";

export const CARBOPLATIN_SUKL_CODE = "0241270";

export const CALVERT_PAPER: Source = {
  citation:
    "Calvert AH et al. Carboplatin dosage: prospective evaluation of a simple formula based on " +
    "renal function. J Clin Oncol 1989;7(11):1748–56.",
  verifiedAt: "2026-09-02",
};

export const CALVERT_SPC: Source = {
  citation:
    "SÚKL, SPC přípravku Carboplatin Accord 10 mg/ml koncentrát pro infuzní roztok, bod 4.2: " +
    "„Dávka (mg) = cílová hodnota AUC (mg/ml x min) x [hodnota GFR ml/min + 25]. " +
    "Cílová hodnota AUC 5-7 mg/ml.min — pouze karboplatina, dříve neléčený; " +
    "4-6 mg/ml.min — pouze karboplatina, již léčený; 4-6 mg/ml.min — karboplatina plus " +
    "cyklofosfamid, dříve neléčený. Poznámka: Při použití Calvertova vzorce se celková dávka " +
    "vypočítává v mg, ne v mg/m2.“",
  url: SPC_URL,
  suklCode: CARBOPLATIN_SUKL_CODE,
  verifiedAt: "2026-09-03",
};

export const DOSE_REDUCTION_SPC: Source = {
  citation:
    "SÚKL, SPC přípravku Carboplatin Accord 10 mg/ml koncentrát pro infuzní roztok, bod 4.2: " +
    "„Počáteční dávkování má být sníženo o 20-25 % u pacientů, kteří vykazují rizikové faktory " +
    "jako například předcházející myelosupresivní léčbu a/nebo nízké hodnoty stavu tělesné " +
    "výkonnosti (ECOG-Zubrod).“",
  url: SPC_URL,
  suklCode: CARBOPLATIN_SUKL_CODE,
  verifiedAt: "2026-09-03",
};

/** Cílové hodnoty AUC podle tabulky v SPC, v mg/ml·min. */
export const AUC_TARGETS = [
  { auc: 5, regimen: "monoterapieNelecen" },
  { auc: 6, regimen: "monoterapieNelecen" },
  { auc: 7, regimen: "monoterapieNelecen" },
  { auc: 4, regimen: "monoterapieLecen" },
  { auc: 5, regimen: "monoterapieLecen" },
  { auc: 6, regimen: "monoterapieLecen" },
] as const;

/** Rozsah snížení úvodní dávky u rizikových pacientů, v procentech. */
export const DOSE_REDUCTION_PERCENT = { min: 20, max: 25 } as const;

/** Koncentrace koncentrátu karboplatiny podle DLP i SPC, v mg/ml. */
export const CARBOPLATIN_MG_PER_ML = 10;
