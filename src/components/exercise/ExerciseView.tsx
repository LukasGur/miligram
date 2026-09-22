"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { CalculatorIcon, CloseIcon } from "@/components/icons";
import { evaluateAnswer, parseAnswer, type Verdict } from "@/core/answer";
import { HINT_COST } from "@/core/economy";
import type { Exercise } from "@/core/types";
import { useAnswerUnit, useExercisePrompt } from "@/i18n/exerciseText";
import { AnswerDisplay } from "./AnswerDisplay";
import { Calculator } from "./Calculator";
import { Keypad } from "./Keypad";
import { TickScale } from "@/components/ui/TickScale";
import { Formula } from "./Formula";
import { Prompt } from "./Prompt";
import { SolutionSteps } from "./SolutionSteps";
import { VerdictPanel } from "./Verdict";

/** Delší číslo než tohle už není odpověď, ale překlep. */
const MAX_INPUT_LENGTH = 9;

export function ExerciseView({
  exercise,
  solved,
  count,
  repeat,
  attempt,
  onExit,
  onAnswered,
  onHint,
  pills,
}: {
  exercise: Exercise;
  /** Kolik příkladů z lekce je hotových. Ukazatel jede podle vyřešených. */
  solved: number;
  count: number;
  /** Příklad, který se vrátil, protože poprvé nevyšel. */
  repeat: boolean;
  /** Kolikátý pokus tohle je. Od druhého se nabídne jít dál. */
  attempt: number;
  onExit: () => void;
  onAnswered: (result: { correct: boolean; hinted: boolean; gaveUp?: boolean }) => void;
  onHint: () => Promise<boolean>;
  pills: number;
}) {
  const t = useTranslations("lesson");
  const tCalculator = useTranslations("calculator");
  const prompt = useExercisePrompt();
  const answerUnit = useAnswerUnit();

  const [input, setInput] = useState("");
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [solutionOpen, setSolutionOpen] = useState(false);
  const [hinted, setHinted] = useState(false);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const answerRef = useRef<HTMLDivElement>(null);

  /**
   * Kalkulačka vyroste odspodu a zabere půl obrazovky. Bez tohohle by pod
   * ní zůstalo pole odpovědi napůl useknuté a student by neviděl, co si
   * do něj přenáší.
   */
  useEffect(() => {
    if (calculatorOpen) answerRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [calculatorOpen]);

  const value = parseAnswer(input);
  /**
   * Ukazatel se hne ve chvíli, kdy odpověď sedne, ne až po klepnutí
   * na Pokračovat. Přístroj potvrzuje hodnotu hned, jak ji přijme.
   */
  const shown = solved + (verdict?.correct ? 1 : 0);
  const canCheck = value !== null && verdict === null;
  const canAfford = pills >= HINT_COST;

  /**
   * Nápověda odkryje první krok řešení, ne výsledek. Prášky se strhnou
   * až po potvrzení zápisu — kdyby se transakce nepovedla, uživatel
   * o ně nepřijde a nápovědu nedostane.
   */
  async function buyHint() {
    if (hinted || !canAfford) return;
    if (await onHint()) setHinted(true);
  }

  function check() {
    if (value === null) return;
    const result = evaluateAnswer(value, exercise.solution.value, exercise.answer.tolerance);
    setVerdict(result);
    // Postup se u chyby otevře sám. Kdo se splete, potřebuje ho vidět,
    // ne po něm ještě sahat.
    setSolutionOpen(!result.correct);
  }

  /**
   * Druhá chyba na témže příkladu. Vracet ho donekonečna je pro toho, kdo
   * látku nezná, slepá ulička — od téhle chvíle se dá projít dál s tím,
   * že se příklad vrátí jindy v opakování chyb.
   */
  const stuck = verdict !== null && !verdict.correct && attempt >= 2;

  return (
    <div className="bg-paper flex h-dvh flex-col overflow-hidden">
      <header
        className="app-chrome flex items-center gap-3 px-4 pb-2"
        style={{ paddingTop: "calc(var(--sa-t) + 0.5rem)" }}
      >
        <button
          type="button"
          onClick={onExit}
          aria-label={t("exit")}
          className="text-ink-soft -ml-2 flex size-11 shrink-0 items-center justify-center"
        >
          <CloseIcon className="size-6" />
        </button>
        <TickScale
          total={count}
          done={shown}
          current={shown}
          label={t("progress", { current: shown, count })}
        />
        <span className="readout text-ink-soft w-12 shrink-0 text-right text-label" data-numeric>
          {t("progress", { current: shown, count })}
        </span>
      </header>

      <main tabIndex={0} className="scroll-y flex-1">
        <div className="mx-auto w-full max-w-md px-5 pb-6">
          {/* Obrazovka potřebuje nadpis, i když ho zrakem nikdo nehledá. */}
          <h1 className="sr-only">{t("progress", { current: shown, count })}</h1>

          {/* Vrácený příklad se označí. Bez toho vypadá jako chyba aplikace,
              že se totéž zadání objevilo podruhé. */}
          {repeat ? <p className="panel-label mb-2">{t("repeat")}</p> : null}

          <Prompt text={prompt(exercise)} />

          {/* U chyby displej mizí: správnou hodnotu i zadanou ukazuje panel
              níž a dvojí výpis téhož čísla jen tříští pozornost. U správné
              odpovědi zůstává — je to ta věc, která se rozsvítí. */}
          {verdict?.correct === false ? null : (
            <div className="mt-6" ref={answerRef}>
              <AnswerDisplay
                value={input}
                unit={answerUnit(exercise)}
                state={verdict === null ? "editing" : "correct"}
                action={
                  verdict === null ? (
                    <span className="-my-1.5 flex items-center gap-1">
                      {hinted ? null : (
                        <button
                          type="button"
                          onClick={buyHint}
                          disabled={!canAfford}
                          className="text-accent disabled:text-ink-soft flex min-h-11 items-center gap-1.5 px-1 text-label font-medium"
                        >
                          {t("hintTitle")}
                          <span className="readout" data-numeric>
                            {HINT_COST}
                          </span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setCalculatorOpen((open) => !open)}
                        aria-label={tCalculator("open")}
                        aria-pressed={calculatorOpen}
                        className={`flex min-h-11 items-center px-1 ${calculatorOpen ? "text-accent" : "text-ink-soft"}`}
                      >
                        <CalculatorIcon className="size-5" />
                      </button>
                    </span>
                  ) : null
                }
              />
            </div>
          )}

          {verdict === null && hinted ? (
            <div className="mt-4">
              <HintPanel exercise={exercise} />
            </div>
          ) : null}

          {verdict ? (
            <div className="mt-5">
              <VerdictPanel exercise={exercise} verdict={verdict} unit={answerUnit(exercise)} answer={value} />

              {/* Dvě akce vedle sebe, jedna přes celou šířku — mřížka s prázdným
                  místem po pravé straně vypadá jako chybějící tlačítko. */}
              <div className="mt-4 flex gap-2 [&>*]:flex-1">
                <SecondaryAction onClick={() => setSolutionOpen((open) => !open)}>
                  {solutionOpen ? t("hideSolution") : t("solutionShort")}
                </SecondaryAction>

                {stuck ? (
                  <SecondaryAction onClick={() => onAnswered({ correct: false, hinted, gaveUp: true })}>
                    {t("giveUp")}
                  </SecondaryAction>
                ) : null}

              </div>

              {solutionOpen ? <SolutionSteps exercise={exercise} /> : null}
            </div>
          ) : null}
        </div>
      </main>

      {/* Ovládací lišta je landmark: klávesnice i tlačítko odpovědi jsou
          obsah stránky a nesmějí zůstat mimo orientační body. */}
      <footer
        className="bg-paper border-line shrink-0 border-t"
        style={{ paddingBottom: "calc(var(--sa-b) + 0.75rem)" }}
      >
        <div className="mx-auto w-full max-w-md px-5 pt-3">
          {verdict !== null ? null : calculatorOpen ? (
            <Calculator
              onUse={(value) => {
                setInput(value.slice(0, MAX_INPUT_LENGTH));
                setCalculatorOpen(false);
              }}
              onClose={() => setCalculatorOpen(false)}
            />
          ) : (
            <Keypad
              onAppend={(character) =>
                setInput((current) => appendCharacter(current, character))
              }
              onBackspace={() => setInput((current) => current.slice(0, -1))}
            />
          )}

          {/* Zatímco se počítá, není co kontrolovat — a tlačítko by z lekce
              udělalo tři řady tlačítek pod sebou. */}
          {calculatorOpen && verdict === null ? null : (
          <button
            type="button"
            onClick={verdict === null ? check : () => onAnswered({ correct: verdict.correct, hinted })}
            disabled={verdict === null && !canCheck}
            className="bg-accent active:bg-accent-press mt-3 min-h-14 w-full rounded-control text-body font-semibold text-white transition-colors duration-75 disabled:opacity-40"
          >
            {verdict === null
              ? t("check")
              : verdict.correct && solved + 1 === count
                ? t("finish")
                : t("continueLabel")}
          </button>
          )}
        </div>
      </footer>
    </div>
  );
}

/**
 * Vedlejší akce: rámeček, ne modrý odkaz. Odkaz vypadá jako text, který
 * se dá přehlédnout, a tohle je volba, ne poznámka.
 */
function SecondaryAction({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="border-line text-ink active:bg-surface flex min-h-11 items-center justify-center gap-2 rounded-control border px-3 text-label font-medium transition-colors duration-75 disabled:opacity-40"
    >
      {children}
    </button>
  );
}

/** Do odpovědi patří číslice a jedna desetinná čárka, nic jiného. */
function appendCharacter(current: string, character: string): string {
  if (current.length >= MAX_INPUT_LENGTH) return current;
  if (character === ",") {
    if (current.includes(",")) return current;
    return current === "" ? "0," : `${current},`;
  }
  // Vedoucí nula se nehromadí: 0 → 5 dá 5, ne 05. „0,“ zůstává.
  if (current === "0") return character;
  return current + character;
}

/** Odkrytý první krok řešení. Dál než k němu nápověda nesahá. */
function HintPanel({ exercise }: { exercise: Exercise }) {
  const t = useTranslations("lesson");
  const tSteps = useTranslations("exercise.steps");
  // První krok je vždy přehled zadaných hodnot; napovídá až ten druhý.
  const step = exercise.solution.steps[1] ?? exercise.solution.steps[0];

  return (
    <section
      /**
       * Nápověda se objeví nad klávesnicí, takže bez odrolování by z ní byl
       * vidět jen nadpis. Ref se zavolá při připojení uzlu — na rozdíl od
       * efektu je to přesně ten okamžik, kdy má obsah přijít do zorného pole.
       */
      ref={(node) => node?.scrollIntoView({ block: "nearest", behavior: "smooth" })}
      className="bg-accent-wash rounded-panel px-4 py-3"
    >
      <h2 className="text-micro text-accent-press uppercase tracking-wide">{t("hintTitle")}</h2>
      <p className="text-label text-ink-soft mt-1">{tSteps(step.textKey)}</p>
      <div className="mt-1 overflow-x-auto">
        {step.formula ? <Formula latex={step.formula} display className="block" /> : null}
        {!step.formula && step.result ? <Formula latex={step.result} className="block" /> : null}
      </div>
    </section>
  );
}

