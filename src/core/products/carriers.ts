import type { Rng } from "../random";
import type { Source } from "../types";

/**
 * Nosné infuzní roztoky pro úlohy na rychlost infuze (F1–F6).
 *
 * Fond z DLP drží jednu reprezentaci na látku a koncentraci, takže z celé
 * skupiny krystaloidů a glukózy zbyly čtyři vaky v jedné velikosti. Tady
 * jsou všechny roztoky, které se na oddělení kapou, i se všemi velikostmi
 * vaků. Kód SÚKL je u každého balení zvlášť; název i objem jsou opsané
 * z DLP (vydání 27. 8. 2026), nic se nedopočítává.
 *
 * Jen nosné roztoky: u léku ve vaku je rychlost součástí dávkování
 * (viz BASE_SOLUTION_ATC v index.ts).
 */
export type Carrier = {
  name: string;
  substance: string;
  atc: string;
  /** Objem jednoho vaku v ml → kód SÚKL toho balení. */
  packs: readonly (readonly [number, string])[];
};

export const CARRIERS: readonly Carrier[] = [
  { name: "CHLORID SODNÝ B.BRAUN 0,9%", substance: "ELEKTROLYTY", atc: "B05BB01", packs: [[50, "0176754"], [100, "0047305"], [250, "0047311"], [500, "0047314"], [1000, "0047308"]] },
  { name: "RINGERŮV ROZTOK VIAFLO", substance: "ELEKTROLYTY", atc: "B05BB01", packs: [[500, "0013440"], [1000, "0013441"]] },
  { name: "RINGERFUNDIN B.BRAUN", substance: "ELEKTROLYTY", atc: "B05BB01", packs: [[250, "0018300"], [500, "0018301"], [1000, "0018302"]] },
  { name: "HARTMANNŮV ROZTOK VIAFLO", substance: "ELEKTROLYTY", atc: "B05BB01", packs: [[250, "0013444"], [500, "0013447"], [1000, "0013452"]] },
  { name: "PLASMALYTE", substance: "ELEKTROLYTY", atc: "B05BB01", packs: [[500, "0011670"], [1000, "0011671"]] },
  { name: "ISOLYTE", substance: "ELEKTROLYTY", atc: "B05BB01", packs: [[500, "0134820"], [1000, "0134821"]] },
  { name: "GLUKÓZA 5% VIAFLO", substance: "CUKRY", atc: "B05BA03", packs: [[50, "0098885"], [100, "0098886"], [250, "0098894"], [500, "0098901"], [1000, "0098902"]] },
  { name: "GLUKÓZA 10% VIAFLO", substance: "CUKRY", atc: "B05BA03", packs: [[250, "0158804"], [500, "0158805"], [1000, "0158806"]] },
  { name: "ARDEANUTRISOL G 5%", substance: "CUKRY", atc: "B05BA03", packs: [[100, "0032348"], [250, "0086966"], [500, "0069741"]] },
  { name: "GNAK", substance: "ELEKTROLYTY SE SACHARIDY", atc: "B05BB02", packs: [[1000, "0231347"]] },
];

export const CARRIER_SOURCE: Source = {
  citation:
    "SÚKL, Databáze léčivých přípravků, vydání 27. 8. 2026 — registrovaná balení nosných infuzních " +
    "roztoků (ATC B05BA03, B05BB01, B05BB02): název a objem vaku.",
  url: "https://opendata.sukl.cz/?q=katalog/databaze-lecivych-pripravku-dlp",
  verifiedAt: "2026-10-05",
};

/**
 * Vylosuje roztok a jeden jeho vak. Napřed roztok, pak velikost — jinak by
 * fyziologický roztok s pěti velikostmi přebil Plasmalyte se dvěma.
 */
export function pickCarrier(
  rng: Rng,
  filter: { minMl?: number; maxMl?: number } = {},
): { code: string; name: string; substance: string; packUnitVolumeMl: number } {
  const fits = ([ml]: readonly [number, string]) =>
    ml >= (filter.minMl ?? 0) && ml <= (filter.maxMl ?? Infinity);
  const carrier = rng.pick(CARRIERS.filter((one) => one.packs.some(fits)));
  const [volumeMl, code] = rng.pick(carrier.packs.filter(fits));
  return { code, name: carrier.name, substance: carrier.substance, packUnitVolumeMl: volumeMl };
}
