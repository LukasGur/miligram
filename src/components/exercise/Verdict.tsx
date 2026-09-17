"use client";

import { useFormatter, useTranslations } from "next-intl";
import { AlertIcon, CheckIcon } from "@/components/icons";
import { Numeral } from "@/components/ui/Numeral";
import type { Verdict as AnswerVerdict } from "@/core/answer";
import type { Exercise } from "@/core/types";

/**
 * Moment vyhodnocení.
 *
 * Nejdřív správná hodnota, velká a strojopisem — to je jediné číslo, které
 * si má student odnést. Teprve pod ní, drobně, co zadal a o kolik se minul.
 * Dřív to byl řádek textu ve stejné velikosti jako zbytek obrazovky.
 *
 * Správná odpověď se hlásí accentem, ne zelenou: aplikace má jen dva
 * významové signály a červená patří výhradně chybě.
 */
export function VerdictPanel({
  exercise,
  verdict,
  unit,
  answer,
}: {
  exercise: Exercise;
  verdict: AnswerVerdict;
  unit: string;
  /** Co uživatel zadal. Ukazuje se jen u chyby, pro porovnání. */
  answer: number | null;
}) {
  const t = useTranslations("lesson");
  const format = useFormatter();

  const decimals = exercise.answer.decimals;
  const correctValue = format.number(exercise.solution.value, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  if (verdict.correct) {
    return (
      <p className="text-accent flex items-center gap-2 text-heading font-semibold">
        <CheckIcon className="size-5 shrink-0" />
        {t("correct")}
      </p>
    );
  }

  return (
    <section className="border-danger/30 rounded-readout border">
      {/* Slovem, ne jen barvou: kdo barvy nerozliší, musí se to dozvědět taky. */}
      <p className="text-danger border-danger/20 flex items-center gap-2 border-b px-4 py-2.5 text-label font-semibold">
        <AlertIcon className="size-5 shrink-0" />
        {t("wrong")}
      </p>

      <div className="border-line border-b px-4 py-3">
        <p className="panel-label">{t("correctIs")}</p>
        <p className="mt-1 flex items-baseline justify-end gap-2">
          <span className="readout text-display font-semibold"><Numeral value={correctValue} /></span>
          <span className="text-ink-soft text-heading">{unit}</span>
        </p>
      </div>

      <dl className="divide-line divide-y text-label">
        <Row label={t("yourAnswer")}>
          <span className="readout text-danger" data-numeric>
            {answer === null ? (
              "—"
            ) : (
              <Numeral
                value={format.number(answer, {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: Math.max(decimals, 2),
                })}
              />
            )}
            <span className="text-ink-soft ml-1.5 font-normal">{unit}</span>
          </span>
        </Row>

        {verdict.magnitudeError ? (
          <Row label={t("deviation")}>
            <span className="readout text-danger" data-numeric>
              {verdict.magnitudeError.exponent > 0
                ? `×${format.number(verdict.magnitudeError.factor)}`
                : `÷${format.number(1 / verdict.magnitudeError.factor)}`}
            </span>
          </Row>
        ) : null}
      </dl>

      {verdict.magnitudeError ? (
        <p className="border-line text-ink-soft border-t px-4 py-3 text-label">
          {verdict.magnitudeError.exponent > 0
            ? t("magnitudeHigher", { factor: verdict.magnitudeError.factor })
            : t("magnitudeLower", { factor: 1 / verdict.magnitudeError.factor })}
        </p>
      ) : null}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-4 py-2.5">
      <dt className="panel-label">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}
