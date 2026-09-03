"use client";

import { useMemo } from "react";
import katex from "katex";
import { useLatexTerms } from "@/i18n/latex";

/**
 * Vzorec sázený KaTeXem.
 *
 * Výstup se vkládá jako HTML, protože jinak ho KaTeX doručit neumí. Vstup
 * ale nikdy nepochází od uživatele — všechny řetězce vznikají v `src/core`
 * ze zástupných symbolů a čísel, takže tudy nevede cesta pro cizí značky.
 * `trust: false` navíc zakazuje příkazy jako \\href, které by uměly odkázat
 * ven, i kdyby se do vzorce nějak dostaly.
 */
export function Formula({
  latex,
  display = false,
  className,
}: {
  latex: string;
  display?: boolean;
  className?: string;
}) {
  const localize = useLatexTerms();
  const html = useMemo(
    () =>
      katex.renderToString(localize(latex), {
        displayMode: display,
        // Chyba v zápisu nesmí shodit obrazovku uprostřed lekce; vysází se
        // červeně a je vidět v testech i při ručním procházení.
        throwOnError: false,
        strict: "ignore",
        trust: false,
      }),
    [latex, display, localize],
  );

  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
