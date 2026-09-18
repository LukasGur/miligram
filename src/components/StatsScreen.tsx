"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useFormatter, useTranslations } from "next-intl";
import { CloseIcon } from "@/components/icons";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { trainableCategories } from "@/core/lesson";
import type { Category } from "@/core/types";
import { LESSON_LENGTH } from "@/core/lessonPlan";
import { Readout } from "@/components/ui/Readout";
import { MEANINGFUL_SAMPLE, mistakesToRepeat, overview, type Mistake } from "@/lib/stats";

/**
 * Statistiky a tréninkové režimy.
 *
 * Čísla se počítají z uložených odpovědí při každém otevření. `useLiveQuery`
 * je přepočítá i uprostřed prohlížení, když mezitím doběhne zápis lekce.
 */
export function StatsScreen({
  onClose,
  onTrain,
}: {
  onClose: () => void;
  onTrain: (mode: { kind: "mistakes"; items: Mistake[] } | { kind: "category"; category: Category }) => void;
}) {
  const t = useTranslations("stats");
  const tCategories = useTranslations("categories");
  const format = useFormatter();

  const stats = useLiveQuery(() => overview(), []);
  const mistakes = useLiveQuery(() => mistakesToRepeat(LESSON_LENGTH), [], []);

  return (
    <div className="bg-paper flex h-dvh flex-col overflow-hidden">
      <header
        className="app-chrome flex items-center justify-between px-5 pb-2"
        style={{ paddingTop: "calc(var(--sa-t) + 0.75rem)" }}
      >
        <h1 className="text-heading font-semibold">{t("title")}</h1>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("title")}
          className="text-ink-soft -mr-3 flex size-11 items-center justify-center"
        >
          <CloseIcon className="size-6" />
        </button>
      </header>

      <main tabIndex={0} className="scroll-y flex-1">
        <div className="mx-auto w-full max-w-md px-5 pb-10">
          {stats === undefined ? null : stats.answered === 0 ? (
            <p className="text-ink-soft text-label">{t("empty")}</p>
          ) : (
            <>
              <div className="border-line divide-line grid grid-cols-3 divide-x border-y py-4">
                <div className="px-3 first:pl-0 last:pr-0">
                  <Readout label={t("lessons")} value={format.number(stats.lessons)} size="small" />
                </div>
                <div className="px-3 first:pl-0 last:pr-0">
                  <Readout label={t("answered")} value={format.number(stats.answered)} size="small" />
                </div>
                <div className="px-3 first:pl-0 last:pr-0">
                  <Readout
                    label={t("rate")}
                    value={stats.rate === null ? "–" : format.number(Math.round(stats.rate * 100))}
                    unit={stats.rate === null ? undefined : "%"}
                    size="small"
                    tone="accent"
                  />
                </div>
              </div>

              <p className="text-ink-soft mt-3 text-micro" data-numeric>
                {t("helpUsed", { hinted: stats.hinted })}
              </p>

              <section className="mt-8">
                <h2 className="text-heading font-semibold">{t("mistakesTitle")}</h2>
                <p className="text-ink-soft mt-1.5 text-label">{t("mistakesBody")}</p>
                {mistakes.length === 0 ? (
                  <p className="text-ink-soft mt-3 text-label">{t("mistakesNone")}</p>
                ) : (
                  <button
                    type="button"
                    onClick={() => onTrain({ kind: "mistakes", items: mistakes })}
                    className="bg-accent active:bg-accent-press mt-3 min-h-12 w-full rounded-control text-body font-semibold text-white"
                  >
                    {t("mistakesStart", { count: mistakes.length })}
                  </button>
                )}
              </section>

              <section className="mt-8">
                <h2 className="text-heading font-semibold">{t("categoriesTitle")}</h2>
                <p className="text-ink-soft mt-1.5 text-label" data-numeric>
                  {t("categoriesHint", { count: MEANINGFUL_SAMPLE })}
                </p>

                <ul className="border-line divide-line mt-4 divide-y border-y">
                  {orderedCategories(stats.categories.map((row) => row.category)).map((category) => {
                    const row = stats.categories.find((item) => item.category === category);
                    const answered = row?.answered ?? 0;
                    const rate = row?.rate ?? null;
                    const shown = answered >= MEANINGFUL_SAMPLE && rate !== null;

                    return (
                      <li key={category}>
                        {/* Celý řádek je tlačítko: cíl přes celou šířku se trefí
                            palcem líp než odkaz na jeho konci. */}
                        <button
                          type="button"
                          onClick={() => onTrain({ kind: "category", category })}
                          aria-label={`${t("train")}: ${tCategories(category)}`}
                          className="active:bg-surface w-full py-3 text-left transition-colors duration-75"
                        >
                          <span className="flex items-center justify-between gap-3">
                            <span className="flex min-w-0 flex-1 items-center gap-2.5">
                              <CategoryIcon category={category} className="text-ink-soft size-5 shrink-0" />
                              <span className="text-body truncate">{tCategories(category)}</span>
                            </span>
                            {shown ? (
                              <span className="readout text-label font-medium" data-numeric>
                                {format.number(Math.round(rate * 100))}
                                <span className="text-ink-soft ml-1 font-normal">%</span>
                              </span>
                            ) : (
                              <span className="text-ink-soft text-micro">{t("tooFew")}</span>
                            )}
                          </span>
                          <span className="bg-surface mt-2 flex h-1.5 overflow-hidden rounded-[1px]">
                            <span
                              className={`h-full rounded-[1px] ${shown ? "bg-accent" : "bg-line"}`}
                              style={{ width: `${shown ? Math.round(rate * 100) : 0}%` }}
                            />
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

/**
 * Nejdřív kategorie, ve kterých už uživatel něco odpověděl (od nejslabší),
 * pak zbytek. Trénovat jde všechno, ale nahoře má být to, co drhne.
 */
function orderedCategories(answered: readonly Category[]): Category[] {
  const rest = trainableCategories().filter((category) => !answered.includes(category));
  return [...answered, ...rest];
}
