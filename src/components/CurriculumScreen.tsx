"use client";

import { useFormatter, useTranslations } from "next-intl";
import { MASTERY_MIN_ANSWERS, MASTERY_MIN_RATE, STAGES, type StageId } from "@/core/curriculum";
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
          <p className="text-ink-soft mt-2 text-label" data-numeric>
            {t("masteryRule", { answers: MASTERY_MIN_ANSWERS, rate: Math.round(MASTERY_MIN_RATE * 100) })}
          </p>

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
                    <span className="flex items-start gap-3">
                      <CategoryIcon
                        category={stage.categories[0]}
                        className={`mt-0.5 size-6 shrink-0 ${current ? "text-accent" : "text-ink-soft"}`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-3">
                          <span className="text-body font-medium">{t(`stages.${stage.id}`)}</span>
                          <StageStatus
                            current={current}
                            mastered={standing?.mastered ?? false}
                            answered={answered}
                            rate={shown ? Math.round(rate * 100) : null}
                          />
                        </span>
                        {/* Co stupeň obsahuje, jedním řádkem. Bez toho byl
                            program osm názvů a nedalo se podle něj vybrat. */}
                        <span className="text-ink-soft block text-label">{t(`descriptions.${stage.id}`)}</span>

                        {/* Do deseti odpovědí dílky, kolik jich chybí; potom
                            úspěšnost s ryskou na hranici zvládnutí. */}
                        {shown ? (
                          <span className="bg-line relative mt-2.5 block h-1 rounded-[1px]">
                            <span
                              className="bg-accent absolute inset-y-0 left-0 rounded-[1px]"
                              style={{ width: `${Math.round(rate * 100)}%` }}
                            />
                            <span
                              aria-hidden
                              className="bg-ink absolute -inset-y-1 w-px"
                              style={{ left: `${Math.round(MASTERY_MIN_RATE * 100)}%` }}
                            />
                          </span>
                        ) : (
                          <span aria-hidden className="mt-2.5 flex gap-0.5">
                            {Array.from({ length: MASTERY_MIN_ANSWERS }, (_, tick) => (
                              <span
                                key={tick}
                                className={`h-1 flex-1 rounded-[1px] ${tick < answered ? "bg-accent" : "bg-line"}`}
                              />
                            ))}
                          </span>
                        )}
                      </span>
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

/** Stav stupně vpravo od názvu: teď, zvládnuto, úspěšnost, nebo kolik odpovědí chybí. */
function StageStatus({
  current,
  mastered,
  answered,
  rate,
}: {
  current: boolean;
  mastered: boolean;
  answered: number;
  /** Úspěšnost v procentech, jakmile je z čeho počítat. */
  rate: number | null;
}) {
  const t = useTranslations("curriculum");
  const format = useFormatter();
  const value =
    rate !== null ? `${format.number(rate)} %` : `${format.number(Math.min(answered, MASTERY_MIN_ANSWERS))}/${format.number(MASTERY_MIN_ANSWERS)}`;

  return (
    <span
      className={`shrink-0 text-micro whitespace-nowrap ${current || mastered ? "text-accent font-semibold" : "text-ink-soft"}`}
      data-numeric
    >
      {current ? `${t("current")} · ` : mastered ? `${t("mastered")} · ` : ""}
      <span className="readout">{value}</span>
      {rate === null ? <span className="sr-only"> {t("answersLabel")}</span> : null}
    </span>
  );
}
