"use client";

import { useTranslations } from "next-intl";
import { Numeral } from "@/components/ui/Numeral";

/**
 * Pole odpovědi jako displej přístroje.
 *
 * Není to `<input>`: hodnotu píše vlastní klávesnice a systémovou nechceme
 * vyvolat. Aby na tom nedoplatila přístupnost, nese pole roli `textbox`
 * s příznakem `readonly` a živě se hlásí odečítači.
 *
 * Číslo je strojopisem a zarovnané doprava, jak to má odečet na přístroji —
 * při psaní se tak nehýbe jednotka, jen přibývají číslice.
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

  const tone =
    state === "correct"
      ? "border-accent animate-accept"
      : state === "wrong"
        ? "border-danger bg-danger-wash"
        : "border-line";

  return (
    <div
      role="textbox"
      aria-readonly
      aria-label={t("answerLabel")}
      aria-live="polite"
      tabIndex={0}
      className={`rounded-readout border px-4 py-3 transition-colors ${tone}`}
    >
      <p className="panel-label">{t("answerLabel")}</p>
      <p className="mt-1 flex items-baseline justify-end gap-2">
        {value === "" ? (
          <span className="text-ink-soft readout text-title">—</span>
        ) : (
          <span className="readout text-display font-semibold"><Numeral value={value} /></span>
        )}
        <span className="text-ink-soft text-heading">{unit}</span>
      </p>
    </div>
  );
}
