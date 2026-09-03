"use client";

import { useTranslations } from "next-intl";

/**
 * Pole odpovědi.
 *
 * Není to `<input>`: hodnotu píše vlastní klávesnice a systémovou nechceme
 * vyvolat. Aby na tom nedoplatila přístupnost, nese pole roli `textbox`
 * s příznakem `readonly` a živě se hlásí odečítači.
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
      ? "border-accent bg-accent-wash"
      : state === "wrong"
        ? "border-danger bg-danger-wash"
        : "border-line bg-paper";

  return (
    <div
      role="textbox"
      aria-readonly
      aria-label={t("answerLabel")}
      aria-live="polite"
      tabIndex={0}
      className={`rounded-panel flex min-h-16 items-baseline justify-center gap-2 border px-5 py-3 transition-colors ${tone}`}
    >
      {value === "" ? (
        <span className="text-ink-soft text-title">{t("answerHint")}</span>
      ) : (
        <span className="num text-display font-semibold tracking-tight">{value}</span>
      )}
      <span className="text-ink-soft text-heading">{unit}</span>
    </div>
  );
}
