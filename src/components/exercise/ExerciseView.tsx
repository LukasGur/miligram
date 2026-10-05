"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { BookIcon, CalculatorIcon, CloseIcon, HintIcon } from "@/components/icons";
import { Balance } from "@/components/ui/Balance";
import { Flyer, bump, reducedMotion, type Flight } from "@/components/ui/Flyer";
import { Pastille } from "@/components/ui/Pastille";
import { PillTag } from "@/components/ui/PillTag";
import { pressable } from "@/lib/press";
import { evaluateAnswer, parseAnswer, type Verdict } from "@/core/answer";
import { HINT_COST, PILLS_PER_CORRECT } from "@/core/economy";
import type { Exercise } from "@/core/types";
import { useAnswerUnit, useExercisePrompt } from "@/i18n/exerciseText";
import { AnswerDisplay } from "./AnswerDisplay";
import { Calculator, EMPTY_CALCULATOR, type CalculatorEntry, type CalculatorState } from "./Calculator";
import { CalculatorHistory } from "./CalculatorHistory";
import { Keypad } from "./Keypad";
import { TickScale } from "@/components/ui/TickScale";
import { Prompt } from "./Prompt";
import { SolutionSteps } from "./SolutionSteps";
import { ExampleSheet } from "./ExampleSheet";
import { HintSheet } from "./HintSheet";
import { STORAGE_KEYS, writeLocal } from "@/lib/localStore";
import { useLocalValue } from "@/lib/clientState";
import { VerdictPanel } from "./Verdict";

/** Delší číslo než tohle už není odpověď, ale překlep. */
const MAX_INPUT_LENGTH = 9;

export function ExerciseView({
  exercise,
  solved,
  count,
  repeat,
  origin,
  newType = false,
  example,
  attempt,
  onExit,
  onChecked,
  onContinue,
  onHint,
  onHelped,
  helped = false,
  pills,
}: {
  exercise: Exercise;
  /** Kolik příkladů z lekce je hotových. Ukazatel jede podle vyřešených. */
  solved: number;
  count: number;
  /** Příklad, který se vrátil, protože poprvé nevyšel. */
  repeat: boolean;
  /** Proč příklad přišel do lekce: dřívější chyba, nebo dřívější nápověda. */
  origin?: "mistake" | "hint";
  /** Typ, který student před chvílí poprvé viděl ve vzoru. */
  newType?: boolean;
  /**
   * Vyřešený vzor u typu, který student ještě nespočítal bez pomoci.
   * Je-li vyplněný, stojí v řádku pomůcek místo nápovědy — zdarma,
   * protože u nového typu je vzor lepší pomoc než kus postupu.
   */
  example?: Exercise;
  /** Kolikátý pokus tohle je. Od druhého se nabídne jít dál. */
  attempt: number;
  onExit: () => void;
  /**
   * Odpověď je vyhodnocená. Zapisuje se hned, ne až s Pokračovat: kdo
   * po verdiktu odejde z aplikace, nesmí se vrátit k nevyplněnému příkladu.
   */
  onChecked: (result: { correct: boolean; hinted: boolean }) => void;
  /** Pokračovat, nebo po druhé chybě vzdát. */
  onContinue: (result: { gaveUp?: boolean }) => void;
  /** Zaplatí nápovědu; vrátí, jestli prošla. */
  onHint: () => Promise<boolean>;
  /** Nápověda nebo vzor se otevřely poprvé — zapíše se to hned. */
  onHelped: () => void;
  /** Pomoc vzatá před odchodem z aplikace: nápověda zůstává odkrytá. */
  helped?: boolean;
  pills: number;
}) {
  const t = useTranslations("lesson");
  const tCalculator = useTranslations("calculator");
  const prompt = useExercisePrompt();
  const answerUnit = useAnswerUnit();

  const [input, setInput] = useState("");
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [solutionOpen, setSolutionOpen] = useState(false);
  /** Kolik kroků nápovědy je odkrytých. Nula = nápověda nevzatá. */
  const [revealed, setRevealed] = useState(helped ? 1 : 0);
  const [exampleOpen, setExampleOpen] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);
  const closeHint = useCallback(() => setHintOpen(false), []);
  /**
   * Student se podíval na vzor. Počítá se jako pomoc, stejně jako nápověda:
   * typ se vrátí v příští lekci, ať ho zkusí sám. Odměnu to nebere — kdyby
   * pomoc stála body, lidé by se jí vyhýbali.
   */
  const [usedExample, setUsedExample] = useState(false);
  const hinted = revealed > 0 || usedExample;
  const closeExample = useCallback(() => setExampleOpen(false), []);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  /** Rozepsaný výpočet přežije zavření kalkulačky (viz CalculatorState). */
  const [calculator, setCalculator] = useState<CalculatorState>(EMPTY_CALCULATOR);
  /**
   * Co se v příkladu spočítalo, pro „Můj výpočet“ po vyhodnocení. Žije jen
   * do Pokračovat — vrácený příklad je nová instance a začíná načisto.
   */
  const [history, setHistory] = useState<(CalculatorEntry & { used?: boolean })[]>([]);
  const [transferred, setTransferred] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  /** Nápověda se nezneaktivní, ale řekne, proč nejde vzít. */
  const [poor, setPoor] = useState(false);
  const format = useFormatter();

  /**
   * Pastilky za příklad. Připisují se hned — do zůstatku v hlavičce
   * doletí, jakmile odpověď sedne, a v databázi jsou po klepnutí
   * na Pokračovat. Tady se jen přičtou k zobrazenému stavu.
   */
  const [landed, setLanded] = useState(false);
  const [flight, setFlight] = useState<Flight | null>(null);
  const earnedRef = useRef<SVGSVGElement>(null);
  const balanceRef = useRef<HTMLSpanElement>(null);
  const balanceIconRef = useRef<SVGSVGElement>(null);
  const launch = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(launch.current), []);

  const value = parseAnswer(input);
  /**
   * Ukazatel se hne ve chvíli, kdy odpověď sedne, ne až po klepnutí
   * na Pokračovat. Přístroj potvrzuje hodnotu hned, jak ji přijme.
   */
  const shown = solved + (verdict?.correct ? 1 : 0);
  const canCheck = value !== null && verdict === null;
  const canAfford = pills >= HINT_COST;
  /** Kroků nápovědy je o jeden méně než kroků řešení — přehled zadání se vynechává. */
  const hintSteps = Math.max(1, exercise.solution.steps.length - 1);
  const balance = pills + (landed ? PILLS_PER_CORRECT : 0);

  /**
   * Nápověda odkrývá postup krok po kroku, ne výsledek. Platí se jednou
   * za příklad; další kroky i nové otevření listu už nic nestojí — kdo
   * potřebuje víc pomoci, nemá platit víc. Pastilky se strhnou až po
   * potvrzení zápisu: kdyby se transakce nepovedla, uživatel o ně
   * nepřijde a nápovědu nedostane.
   */
  async function takeHint() {
    if (revealed > 0) {
      setHintOpen(true);
      return;
    }
    if (!canAfford) {
      setPoor(true);
      return;
    }
    setPoor(false);
    if (await onHint()) {
      setRevealed(1);
      setHintOpen(true);
      onHelped();
    }
  }

  function openExample() {
    setExampleOpen(true);
    if (!usedExample) onHelped();
    setUsedExample(true);
    writeLocal(STORAGE_KEYS.exampleCoachSeen, "1");
  }

  function check() {
    if (value === null) return;
    const result = evaluateAnswer(value, exercise.solution.value, exercise.answer.tolerance);
    setVerdict(result);
    onChecked({ correct: result.correct, hinted });
    if (result.correct && !repeat) {
      if (reducedMotion()) {
        setLanded(true);
      } else {
        // Nejdřív se „+2“ ukáže u verdiktu, pak pastilka odletí nahoru.
        launch.current = window.setTimeout(() => {
          const from = earnedRef.current?.getBoundingClientRect();
          const to = balanceIconRef.current?.getBoundingClientRect();
          if (from && to) setFlight({ id: 0, from, to, delay: 0 });
          else setLanded(true);
        }, 380);
      }
    }
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
        {/* Místo počítadla „3/7“ zůstatek: postup ukazují dílky vedle,
            a kdo vidí cenu nápovědy, má vidět i to, na co mu zbývá. */}
        <Balance
          ref={balanceRef}
          iconRef={balanceIconRef}
          value={format.number(balance)}
          label={t("balance", { count: balance })}
        />
      </header>

      {flight ? (
        <Flyer
          flight={flight}
          onLand={() => {
            setFlight(null);
            setLanded(true);
            bump(balanceRef.current);
          }}
        />
      ) : null}

      {/* Nahoře se čte, dole se ovládá. Zadání roluje, přístroj — odečet,
          pomůcky a klávesnice — zůstává na místě, takže se pod patičku nic
          neschová a palec ví, kde co hledat. */}
      <main tabIndex={0} className="scroll-y flex-1">
        <div className="mx-auto w-full max-w-md px-5 pb-6">
          {/* Obrazovka potřebuje nadpis, i když ho zrakem nikdo nehledá. */}
          <h1 className="sr-only">{t("progress", { current: shown, count })}</h1>

          {/* Vrácený příklad se označí. Bez toho vypadá jako chyba aplikace,
              že se totéž zadání objevilo podruhé. Stejně tak typ, který
              přišel kvůli dřívější chybě nebo nápovědě: student má vědět,
              proč se mu v lekci objevil, a že ho tu čeká záměrně. */}
          {repeat || origin || newType ? (
            <p className="panel-label mb-2">
              {repeat
                ? t("repeat")
                : origin === "mistake"
                  ? t("fromMistake")
                  : origin === "hint"
                    ? t("fromHint")
                    : t("newType")}
            </p>
          ) : null}

          <Prompt text={prompt(exercise)} />

          {verdict ? (
            <div className="mt-5">
              <div className="relative">
                <VerdictPanel exercise={exercise} verdict={verdict} unit={answerUnit(exercise)} answer={value} />
                {/* Odměna je za první pokus, takže u vráceného příkladu
                    nevystoupá nic — ani „+0“, které by působilo jako trest. */}
                {verdict.correct && !repeat ? <Earned count={PILLS_PER_CORRECT} iconRef={earnedRef} /> : null}
              </div>

              {/* Dvě akce vedle sebe, jedna přes celou šířku — mřížka s prázdným
                  místem po pravé straně vypadá jako chybějící tlačítko. Třetí
                  jde na vlastní řádek: tři popisky vedle sebe se na úzkém
                  telefonu nevejdou. */}
              <div className="mt-4 flex gap-2 [&>*]:flex-1">
                <SecondaryAction expanded={solutionOpen} onClick={() => setSolutionOpen((open) => !open)}>
                  {solutionOpen ? t("hideSolution") : t("solutionShort")}
                </SecondaryAction>

                {history.length > 0 ? (
                  <SecondaryAction expanded={historyOpen} onClick={() => setHistoryOpen((open) => !open)}>
                    {historyOpen ? tCalculator("hideHistory") : tCalculator("history")}
                  </SecondaryAction>
                ) : stuck ? (
                  <GiveUp onPress={() => onContinue({ gaveUp: true })} />
                ) : null}
              </div>

              {history.length > 0 && stuck ? (
                <div className="mt-2 flex [&>*]:flex-1">
                  <GiveUp onPress={() => onContinue({ gaveUp: true })} />
                </div>
              ) : null}

              {historyOpen ? <CalculatorHistory entries={history} transferred={transferred} answer={input} /> : null}

              {solutionOpen ? <SolutionSteps exercise={exercise} /> : null}
            </div>
          ) : null}
        </div>
      </main>

      {/* Ovládací lišta je landmark: odečet, pomůcky, klávesnice i tlačítko
          odpovědi jsou obsah stránky a nesmějí zůstat mimo orientační body. */}
      <footer
        className="bg-paper border-line shrink-0 border-t"
        style={{ paddingBottom: "calc(var(--sa-b) + 0.75rem)" }}
      >
        <div className="mx-auto w-full max-w-md px-5 pt-3">
          {/* U chyby displej mizí: správnou hodnotu i zadanou ukazuje panel
              nahoře a dvojí výpis téhož čísla jen tříští pozornost. U správné
              odpovědi zůstává — je to ta věc, která se rozsvítí. */}
          {verdict?.correct === false ? null : (
            <AnswerDisplay
              value={input}
              unit={answerUnit(exercise)}
              state={verdict === null ? "editing" : "correct"}
            />
          )}

          {/* Pomůcky mají vlastní řádek, ne kout displeje. Nalepené v poli
              odpovědi nevypadaly jako tlačítka a cena nápovědy se pletla
              s odpovědí. Otevřená kalkulačka si jejich místo bere pro větší
              klávesy — zavírá se křížkem na svém displeji. */}
          {verdict === null && !calculatorOpen ? (
            <div className="relative mt-2 flex gap-2 [&>*]:flex-1">
              <Tool
                icon={<CalculatorIcon className="size-5 shrink-0" />}
                label={tCalculator("title")}
                pressed={calculatorOpen}
                onPress={() => setCalculatorOpen((open) => !open)}
              />
              {/* U typu, který student ještě nezvládl sám, je na místě
                  nápovědy vzor. Zůstává i po otevření, dá se k němu vracet. */}
              {example ? (
                <Tool
                  icon={<BookIcon className="size-5 shrink-0" />}
                  label={t("exampleTool")}
                  ariaLabel={t("exampleToolLabel")}
                  onPress={openExample}
                />
              ) : revealed > 0 ? (
                // Zaplacená nápověda zůstává po ruce: místo ceny ukazuje,
                // kolik kroků je odkrytých, a otevře se tam, kde skončila.
                <Tool
                  icon={<HintIcon className="size-5 shrink-0" />}
                  label={t("hintTitle")}
                  detail={t("hintStep", { current: Math.min(revealed, hintSteps), total: hintSteps })}
                  ariaLabel={t("hintOpenLabel", { current: Math.min(revealed, hintSteps), total: hintSteps })}
                  onPress={takeHint}
                />
              ) : (
                <Tool
                  icon={<HintIcon className="size-5 shrink-0" />}
                  label={t("hintTitle")}
                  cost={HINT_COST}
                  costLabel={t("hintPrice", { cost: HINT_COST })}
                  onPress={takeHint}
                />
              )}
              {example ? <ExampleCoach /> : null}
            </div>
          ) : null}

          {poor ? (
            <p className="text-ink-soft mt-2 text-label" role="status">
              {t("hintPoor", { cost: HINT_COST })}
            </p>
          ) : null}

          {verdict !== null ? null : calculatorOpen ? (
            <div className="mt-2">
              <Calculator
                state={calculator}
                onState={setCalculator}
                onCalculate={(entry) => setHistory((current) => [...current, entry])}
                onUse={(value) => {
                  const answer = value.slice(0, MAX_INPUT_LENGTH);
                  setInput(answer);
                  setTransferred(answer);
                  // Převzít se dá jen to, co už je v historii — zapsané
                  // těsně předtím, nebo po „=“. Je to vždy poslední řádek.
                  setHistory((current) =>
                    current.map((entry, index) => ({ ...entry, used: index === current.length - 1 })),
                  );
                  setCalculatorOpen(false);
                }}
                onClose={() => setCalculatorOpen(false)}
              />
            </div>
          ) : (
            <div className="mt-2">
              <Keypad
                onAppend={(character) => setInput((current) => appendCharacter(current, character))}
                onBackspace={() => setInput((current) => current.slice(0, -1))}
              />
            </div>
          )}

          {/* Zatímco se počítá, není co kontrolovat — a tlačítko by z panelu
              udělalo čtyři řady pod sebou. */}
          {calculatorOpen && verdict === null ? null : (
            <button
              type="button"
              onClick={verdict === null ? check : () => onContinue({})}
              {...pressable}
              disabled={verdict === null && !canCheck}
              className="press press-wide bg-accent data-pressed:bg-accent-press mt-3 min-h-14 w-full rounded-control text-body font-semibold text-white disabled:opacity-40"
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

      {exampleOpen && example ? <ExampleSheet example={example} onClose={closeExample} /> : null}
      {hintOpen && verdict === null ? (
        <HintSheet
          exercise={exercise}
          revealed={revealed}
          onNext={() => setRevealed((count) => count + 1)}
          onClose={closeHint}
        />
      ) : null}
    </div>
  );
}

/**
 * Pastilky za příklad, u „Správně“. Zůstávají stát jako potvrzení toho,
 * co odletělo do zůstatku — hlavním signálem ale zůstává „Správně“.
 */
function Earned({ count, iconRef }: { count: number; iconRef: React.Ref<SVGSVGElement> }) {
  const t = useTranslations("lesson");
  return (
    <span
      role="status"
      className="text-pill animate-tick absolute top-0 right-0 flex h-7 items-center gap-1.5 text-body font-semibold"
    >
      <span className="readout" data-numeric aria-hidden>
        +{count}
      </span>
      <Pastille ref={iconRef} className="size-5" />
      <span className="sr-only">{t("earned", { count })}</span>
    </span>
  );
}

/**
 * Pomůcka k příkladu: kalkulačka nebo nápověda.
 *
 * Rámeček, ikona a popisek — vypadá to jako tlačítko, protože to tlačítko
 * je. Cena nápovědy je cenovka s pastilkou — stejný symbol jako
 * zůstatek na úvodní obrazovce, takže je jasné, v čem se platí, a holé
 * číslo se nedá přečíst jako část odpovědi nebo zadání.
 */
function Tool({
  icon,
  label,
  cost,
  detail,
  costLabel,
  ariaLabel,
  pressed,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  cost?: number;
  /** Stav místo ceny, třeba „2 / 4“. Odečítač ho čte z `ariaLabel`. */
  detail?: string;
  /** Cena slovy pro odečítač: „15 pastilek“. */
  costLabel?: string;
  /** Celý popis pro odečítač, když krátký nápis nestačí. */
  ariaLabel?: string;
  pressed?: boolean;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      {...pressable}
      aria-pressed={pressed}
      aria-label={ariaLabel}
      className={`press press-wide flex min-h-11 items-center justify-center gap-2 rounded-control border px-3 text-label font-medium ${
        pressed
          ? "border-accent bg-accent-wash text-accent data-pressed:bg-accent-wash-press"
          : "border-line text-ink data-pressed:border-surface-press data-pressed:bg-surface-press"
      }`}
    >
      {icon}
      <span className="truncate">{label}</span>
      {cost === undefined ? null : (
        <PillTag>
          <span className="num" data-numeric aria-hidden>
            {cost}
          </span>
          <span className="sr-only">{costLabel}</span>
        </PillTag>
      )}
      {detail === undefined ? null : (
        <span className="num text-ink-soft shrink-0" data-numeric aria-hidden>
          {detail}
        </span>
      )}
    </button>
  );
}

/**
 * Bublina nad vzorem, jen úplně poprvé. Vzor stojí tam, kde student
 * zvyklý na aplikaci čeká nápovědu — jednou se to řekne, pak už ne.
 * Zavře se klepnutím kamkoli; klepnutí jde dál, takže se tím rovnou
 * třeba otevře vzor nebo napíše číslice.
 */
function ExampleCoach() {
  const t = useTranslations("lesson");
  const seen = useLocalValue(STORAGE_KEYS.exampleCoachSeen);

  useEffect(() => {
    if (seen) return;
    const dismiss = () => writeLocal(STORAGE_KEYS.exampleCoachSeen, "1");
    document.addEventListener("pointerdown", dismiss, { capture: true, once: true });
    return () => document.removeEventListener("pointerdown", dismiss, { capture: true });
  }, [seen]);

  if (seen) return null;

  return (
    <div
      role="status"
      className="animate-tick bg-ink text-paper pointer-events-none absolute right-0 bottom-full z-10 mb-2.5 w-[min(16rem,calc(50%+4rem))] !flex-none rounded-panel px-3.5 py-2.5 text-label shadow-lg"
    >
      {t("exampleCoach")}
      {/* Špička míří na tlačítko vzoru pod bublinou. */}
      <span aria-hidden className="bg-ink absolute right-8 -bottom-1 size-2.5 rotate-45" />
    </div>
  );
}

/** Jít dál bez správné odpovědi. Nabízí se od druhé chyby. */
function GiveUp({ onPress }: { onPress: () => void }) {
  const t = useTranslations("lesson");
  return <SecondaryAction onClick={onPress}>{t("giveUp")}</SecondaryAction>;
}

/**
 * Vedlejší akce: rámeček, ne modrý odkaz. Odkaz vypadá jako text, který
 * se dá přehlédnout, a tohle je volba, ne poznámka.
 */
function SecondaryAction({
  onClick,
  disabled,
  expanded,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  /** U přepínačů, které rozbalují obsah pod sebou. */
  expanded?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      {...pressable}
      disabled={disabled}
      aria-expanded={expanded}
      className="press press-wide border-line text-ink data-pressed:border-surface-press data-pressed:bg-surface-press flex min-h-11 items-center justify-center gap-2 rounded-control border px-3 text-label font-medium disabled:opacity-40"
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
