"use client";

import { useFormatter, useTranslations } from "next-intl";
import { MASTERY_MIN_ANSWERS, STAGES, type StageId } from "@/core/curriculum";
import { blockingFor, type CurriculumState } from "@/lib/curriculum";
import { CloseIcon } from "./icons";
import { CategoryIcon } from "./ui/CategoryIcon";

/**
 * Program: v jakém pořadí se učivo probírá.
 *
 * Pořadí je opsané z praktických cvičení na lékařské fakultě, ale **nic
 * se nezamyká**. Výpočty dávkování nejsou kumulativní jako jazyk a medik
 * před zkouškou má právo jít rovnou na to, co potřebuje. Kde stupeň stojí
 * na látce, kterou student nemá zvládnutou, se to napíše — větou, ne
 * závorou.
 */
export function CurriculumScreen({
  state,
  onClose,
  onStart,
}: {
  state: CurriculumState | undefined;
  onClose: () => void;
  onStart: (stage: StageId) => void;
}) {
  const t = useTranslations("curriculum");
  const format = useFormatter();

  /**
   * Než student cokoli odpoví, nemá věta „stojí na látce, kterou jsi
   * nezkoušel“ co říct — stála by u sedmi stupňů z osmi a program by
   * vypadal jako seznam výmluv. Objeví se, jakmile je z čeho vycházet.
   */
  const started = (state?.standings ?? []).some((one) => one.answered > 0);

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
          aria-label={t("close")}
          className="text-ink-soft -mr-3 flex size-11 items-center justify-center"
        >
          <CloseIcon className="size-6" />
        </button>
      </header>

      <main tabIndex={0} className="scroll-y flex-1">
        <div className="mx-auto w-full max-w-md px-5 pb-10">
          <p className="text-ink-soft text-label">{t("intro")}</p>

          <ul className="divide-line mt-4 divide-y border-t">
            {STAGES.map((stage) => {
              const standing = state?.standings.find((one) => one.stage === stage.id);
              const answered = standing?.answered ?? 0;
              const rate = standing?.rate ?? null;
              const shown = answered >= MASTERY_MIN_ANSWERS && rate !== null;
              const blocking = state && started ? blockingFor(state, stage.id) : null;
              const current = state?.current === stage.id;

              return (
                <li key={stage.id}>
                  {/* Celý řádek je tlačítko — cíl přes celou šířku se trefí
                      palcem líp než odkaz na jeho konci. */}
                  <button
                    type="button"
                    onClick={() => onStart(stage.id)}
                    disabled={state === undefined}
                    className="active:bg-surface w-full py-3 text-left transition-colors duration-75"
                  >
                    <span className="flex items-center gap-3">
                      <CategoryIcon
                        category={stage.categories[0]}
                        className={`size-6 shrink-0 ${current ? "text-accent" : "text-ink-soft"}`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="text-body block">{t(`stages.${stage.id}`)}</span>
                        {current ? (
                          <span className="text-accent block text-micro font-medium">{t("current")}</span>
                        ) : standing?.mastered ? (
                          <span className="text-ink-soft block text-micro">{t("mastered")}</span>
                        ) : null}
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

                    {/* Informace, ne zákaz: stupeň jde spustit i tak. */}
                    {blocking ? (
                      <span className="text-ink-soft mt-2 block text-micro">
                        {blocking.rate === null
                          ? t("restsOnUntouched", { stage: t(`stages.${blocking.stage}`) })
                          : t("restsOn", {
                              stage: t(`stages.${blocking.stage}`),
                              rate: Math.round(blocking.rate * 100),
                            })}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </main>
    </div>
  );
}
