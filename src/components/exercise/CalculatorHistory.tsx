"use client";

import { useTranslations } from "next-intl";
import { format } from "@/core/calculator";
import type { CalculatorEntry } from "./Calculator";

/**
 * Co student v příkladu spočítal v kalkulačce.
 *
 * Když odpověď nesedí a postup vypadá stejně jako to, co do kalkulačky
 * zadával, je snadné začít pochybovat o kalkulačce. Tady je černé na bílém,
 * co opravdu zadal — překlep v čísle, prohozený operátor, nebo výsledek,
 * který se do odpovědi nedostal.
 *
 * Stojí nad postupem, aby se výraz dal porovnat s krokem Dosazení bez
 * přepínání. Převzatý výsledek nese štítek, ne barvu: červená patří jen
 * verdiktu a tady by obviňovala řádek, který může být v pořádku.
 */
export function CalculatorHistory({
  entries,
  transferred,
  answer,
}: {
  /** `used` nese řádek, který šel naposledy do odpovědi. */
  entries: readonly (CalculatorEntry & { used?: boolean })[];
  /** Co se tehdy do odpovědi propsalo. */
  transferred: string | null;
  /** Odpověď, jak byla odeslaná. */
  answer: string;
}) {
  const t = useTranslations("calculator");

  const note = !entries.some((entry) => entry.used)
    ? t("historyTyped", { value: answer })
    : transferred !== answer
      ? t("historyEdited", { value: answer })
      : null;

  return (
    <section
      /** Otevírá se klepnutím, takže se má ukázat, ne zůstat pod okrajem. */
      ref={(node) => node?.scrollIntoView({ block: "nearest", behavior: "smooth" })}
      className="mt-5"
    >
      <h2 className="text-label text-ink-soft font-semibold">{t("history")}</h2>

      <ol className="border-line divide-line mt-3 divide-y rounded-readout border">
        {entries.map((entry, index) => (
          <li key={index} className="flex items-baseline gap-3 px-4 py-2.5">
            <span className="readout text-ink-soft min-w-0 flex-1 break-words text-label" data-numeric>
              {entry.expression}
            </span>
            <span className="flex shrink-0 flex-col items-end gap-1">
              <span className="readout text-body font-semibold" data-numeric>
                <span className="text-ink-soft mr-1.5 font-normal" aria-hidden>
                  =
                </span>
                {format(entry.result)}
              </span>
              {entry.used ? (
                <span className="bg-accent-wash text-accent-press rounded-full px-2 py-0.5 text-micro font-medium">
                  {entry.result < 0 ? t("historyUsedNegative") : t("historyUsed")}
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ol>

      {note ? <p className="text-ink-soft mt-2 text-label">{note}</p> : null}
    </section>
  );
}
