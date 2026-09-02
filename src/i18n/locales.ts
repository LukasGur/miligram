import cs from "../../messages/cs.json";
import sk from "../../messages/sk.json";

export const locales = ["cs", "sk"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "cs";

/**
 * Oba katalogy jsou v bundlu záměrně: aplikace musí umět přepnout jazyk
 * offline a bez čekání na síť. Až jazyků přibude, nahradí to dynamický
 * import s vlastním záznamem v precache manifestu.
 */
export const messages: Record<Locale, typeof cs> = { cs, sk };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}

/** Slovenština i čeština jsou si blízké — pokud prohlížeč hlásí jednu z nich, respektuj to. */
export function detectLocale(preferred: readonly string[]): Locale {
  for (const tag of preferred) {
    const base = tag.toLowerCase().split("-")[0];
    if (isLocale(base)) return base;
  }
  return defaultLocale;
}
