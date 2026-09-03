"use client";

import { useTranslations } from "next-intl";

/**
 * Překlad slov ve vzorcích.
 *
 * Výpočetní jádro nesmí obsahovat text v žádném jazyce, ale vzorec typu
 * „objem = dávka / koncentrace“ se bez slov nedá napsat srozumitelně.
 * Jádro proto sází tokeny (`\text{@dose}`) a jazyk se doplní až tady.
 * Test `typesetting.test.ts` hlídá, že v jádru nezůstane nic jiného
 * než ASCII — jakmile by se do vzorce vloudilo české slovo, spadne.
 */
const TOKEN = /@([a-zA-Z]+)/g;

export function useLatexTerms(): (latex: string) => string {
  const t = useTranslations("exercise.terms") as unknown as (key: string) => string;
  return (latex) => latex.replace(TOKEN, (_match, key: string) => t(key));
}
