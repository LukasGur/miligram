/**
 * Přípravek z databáze léčivých přípravků SÚKL.
 *
 * Fond slouží k tomu, aby generátor nelosoval pořád tentýž lék. Údaje
 * pocházejí z DLP a každý je dohledatelný podle kódu SÚKL; výběr, které
 * látky do fondu patří, je kurátorské rozhodnutí a žije zvlášť
 * v scripts/sukl/latky-vyber.json.
 */
export type ProductKind =
  /** Tableta nebo tobolka — síla je celkový obsah v jednotce. */
  | "tablet"
  /** Perorální suspenze, sirup nebo kapky — síla je koncentrace. */
  | "oralLiquid"
  /** Ampule do 50 ml — odměřuje se stříkačkou. */
  | "ampoule"
  /** Koncentrát, který se před podáním ředí. */
  | "concentrate"
  /** Lyofilizát k rekonstituci. */
  | "powderVial"
  /** Hotový infuzní vak od 50 ml. */
  | "infusionBag";

export type Product = {
  /** Kód SÚKL — jednoznačně identifikuje registrované balení. */
  code: string;
  /** Obchodní název tak, jak ho uvádí DLP. */
  name: string;
  /** Název účinné látky podle číselníku ATC. */
  substance: string;
  atc: string;
  kind: ProductKind;
  /** Obsah účinné látky v mg, u biologických přípravků v IU. */
  strength: number;
  strengthUnit: "mg" | "IU";
  /** Objem, ve kterém je síla uvedená. U tablet a lyofilizátů chybí. */
  volumeMl?: number;
  /** Léková forma podle číselníku SÚKL. */
  form: string;
  /** Velikost balení tak, jak ji uvádí DLP. */
  pack: string;
  /** Počet kusů v balení, jde-li ho z balení vyčíst. */
  packCount?: number;
  /** Objem jednoho kusu v ml, jde-li ho z balení vyčíst. */
  packUnitVolumeMl?: number;
};
