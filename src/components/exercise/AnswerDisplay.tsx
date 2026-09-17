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
 * při psaní se nehýbe jednotka, jen přibývají číslice.
 */
export function AnswerDisplay({
  value,
  unit,
  state,
  action,
}: {
  value: string;
  unit: string;
  state: "editing" | "correct" | "wrong";
  /**
   * Místo pro nabídku nápovědy. Patří sem, a ne pod pole: obrazovku
   * vyplní zadání s klávesnicí a všechno pod polem se propadne pod okraj,
   * takže by nabídku nikdo nenašel.
   */
  action?: React.ReactNode;
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
    <div className={`rounded-readout border px-4 py-3 transition-colors ${tone}`}>
      <div className="flex min-h-6 items-center justify-between gap-3">
        <span className="panel-label" id={labelId}>
          {t("answerLabel")}
        </span>
        {action}
      </div>

      <div
        role="textbox"
        aria-readonly
        aria-labelledby={labelId}
        aria-live="polite"
        tabIndex={0}
        className="mt-1 flex items-baseline justify-end gap-2"
      >
        {value === "" ? (
          <span className="text-ink-soft readout text-title">—</span>
        ) : (
          <span className="readout text-display font-semibold">
            <Numeral value={value} />
          </span>
        )}
        <span className="text-ink-soft text-heading">{unit}</span>
      </div>
    </div>
  );
}
