"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { Numeral } from "@/components/ui/Numeral";

/**
 * Pole odpovědi jako displej přístroje.
 *
 * Hodnotu píše vlastní klávesnice, systémovou nechceme vyvolat — proto ne
 * `<input>`. Aby na tom nedoplatila přístupnost, nese odečet roli `textbox`
 * s příznakem `readonly` a živě se hlásí odečítači.
 *
 * Číslo je strojopisem a zarovnané doprava, jak to má odečet na přístroji:
 * při psaní se nehýbe jednotka, jen přibývají číslice. Popisek sedí vedle
 * hodnoty, ne nad ní — na telefonu nese spodní panel odečet, pomůcky,
 * klávesnici i hlavní tlačítko a na zadání nahoře pak zbývají tři řádky.
 * Tlačítka do pole nepatří, pomůcky mají vlastní řádek pod ním.
 */
export function AnswerDisplay({
  value,
  unit,
  state,
}: {
  value: string;
  unit: string;
  state: "editing" | "correct" | "wrong";
}) {
  const t = useTranslations("lesson");
  const labelId = useId();

  const tone =
    state === "correct"
      ? "border-accent animate-accept"
      : state === "wrong"
        ? "border-danger bg-danger-wash"
        : "border-line";

  return (
    <div className={`rounded-readout flex items-center gap-3 border px-4 py-2.5 transition-colors ${tone}`}>
      <span className="panel-label shrink-0" id={labelId}>
        {t("answerLabel")}
      </span>

      <div
        role="textbox"
        aria-readonly
        aria-labelledby={labelId}
        aria-live="polite"
        tabIndex={0}
        className="flex min-w-0 flex-1 items-baseline justify-end gap-2"
      >
        {value === "" ? (
          <span className="text-ink-soft readout text-title">—</span>
        ) : (
          <span className="readout truncate text-title font-semibold">
            <Numeral value={value} />
          </span>
        )}
        <span className="text-ink-soft shrink-0 text-body">{unit}</span>
      </div>
    </div>
  );
}
