/**
 * Název přípravku do zadání: jak stojí na krabičce, ne v hlavičce SPC.
 *
 * Fond z DLP nese krátké názvy velkými písmeny („TENSAMIN“), tabulky
 * opsané ze SPC celý název včetně lékové formy („Ceftriaxon Kabi 1 g
 * prášek pro injekční/infuzní roztok“). Vedle sebe v jedné lekci to
 * působilo jako dvě různé aplikace a dlouhý název zadání zahltil.
 * Tady se z celého názvu nechá značka velkými písmeny a síla; léková
 * forma odpadne, zadání ji říká samo. Ve zdroji zůstává název celý.
 */
const FORM = /\s(?:prášek|perorální|injekční|infuzní|koncentrát|tablety|tableta|potahované|granule|sirup|suspenze|roztok|čípky|tvrdé|měkké|enterosolventní)(?=[\s/]|$).*$/iu;

export function packageLabel(spcName: string): string {
  const short = spcName.replace(FORM, "").trim();
  const firstDigit = short.search(/\d/);
  const brand = firstDigit === -1 ? short : short.slice(0, firstDigit);
  const strength = firstDigit === -1 ? "" : short.slice(firstDigit);
  return `${brand.toLocaleUpperCase("cs")}${strength}`.replace(/\s+/g, " ").trim();
}
