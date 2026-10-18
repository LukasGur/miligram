"use client";

import type { Dispatch, SetStateAction } from "react";
import { useTranslations } from "next-intl";
import { BackspaceIcon, CloseIcon, PlusMinusIcon } from "@/components/icons";
import { pressable } from "@/lib/press";
import { evaluate, format, parse, render, type Operator, type Token } from "@/core/calculator";

/**
 * Kalkulačka uvnitř lekce.
 *
 * Systémovou otevřít nejde — iOS pro ni nemá odkaz — a přepínání aplikací
 * uprostřed lekce je přesně to, čemu se aplikace na ploše vyhýbá. Počítat
 * se přitom musí: čísla ze souhrnů údajů jsou taková, jaká jsou, a cvičí
 * se postavení výpočtu, ne dlouhé dělení. Zkoušky to ostatně vidí stejně —
 * zakázané jsou lékové databáze, ne kalkulačka.
 *
 * Stojí na místě klávesnice, ne přes obrazovku: zadání musí zůstat vidět,
 * jinak si student čísla přepisuje po paměti a chyba vznikne tady.
 *
 * Každý dopočítaný výraz hlásí ven. Po vyhodnocení si ho student může
 * projít a zjistit, jestli se uklikl, nebo počítal jinak než postup.
 */
/**
 * Rozepsaný výpočet. Drží ho obrazovka příkladu, ne kalkulačka: kdo ji
 * zavře, aby se podíval na vzor nebo nápovědu, najde po návratu výpočet
 * tam, kde ho nechal. Načisto začíná až další příklad.
 */
export type CalculatorState = {
  tokens: Token[];
  pending: string;
  /**
   * Na displeji je výsledek právě zapsaného „=“. Převzetí ho pak nezapíše
   * podruhé; jakákoli další klávesa zápis zase otevře.
   */
  settled: boolean;
};

export const EMPTY_CALCULATOR: CalculatorState = { tokens: [], pending: "", settled: false };

export function Calculator({
  state,
  onState,
  onCalculate,
  onUse,
  onClose,
}: {
  state: CalculatorState;
  onState: Dispatch<SetStateAction<CalculatorState>>;
  /** Dopočítaný výraz: po „=“, nebo po „Použít“ bez něj. */
  onCalculate: (entry: CalculatorEntry) => void;
  /** Převezme výsledek do odpovědi a zavře kalkulačku. */
  onUse: (value: string) => void;
  onClose: () => void;
}) {
  const t = useTranslations("calculator");
  const tLesson = useTranslations("lesson");
  const { tokens, pending, settled } = state;
  const setTokens = (next: SetStateAction<Token[]>) =>
    onState((current) => ({ ...current, tokens: typeof next === "function" ? next(current.tokens) : next }));
  const setPending = (next: SetStateAction<string>) =>
    onState((current) => ({ ...current, pending: typeof next === "function" ? next(current.pending) : next }));
  const setSettled = (next: boolean) => onState((current) => ({ ...current, settled: next }));

  const complete: Token[] = (() => {
    const value = parse(pending);
    return value === null ? tokens : [...tokens, { kind: "number", value }];
  })();
  const result = evaluate(complete);
  /**
   * Odpověď v žádném příkladu záporná není. Záporný výsledek tu skoro vždy
   * znamená odčítání v obráceném pořadí, a tak se převezme bez znaménka —
   * ale viditelně, štítkem na tlačítku i v historii, ne potichu.
   */
  const negative = result !== null && result < 0;

  function append(character: string) {
    setSettled(false);
    const last = tokens[tokens.length - 1];
    if (pending === "" && last?.kind === "number") {
      // Číslice po „=“ začíná nový výpočet, jako na každé kalkulačce.
      // Jinde tu číslo stojí jen po smazání operátoru, a pak se dopisuje
      // dál. Dvě čísla bez operátoru vedle sebe by nedávala smysl.
      const start = settled ? "" : format(last.value);
      setTokens(settled ? [] : tokens.slice(0, -1));
      setPending(start === "" && character === "," ? "0," : start + character);
      return;
    }
    setPending((current) => {
      if (character === "," && current.includes(",")) return current;
      if (current === "0" && character !== ",") return character;
      return current + character;
    });
  }

  function operator(value: Operator) {
    setSettled(false);
    const number = parse(pending);
    if (number !== null) {
      setTokens((current) => [...current, { kind: "number", value: number }, { kind: "operator", value }]);
      setPending("");
      return;
    }
    setTokens((current) => {
      const last = current[current.length - 1];
      if (last === undefined) return current;
      // Zápis končí operátorem: student si to rozmyslel, vyměníme ho.
      if (last.kind === "operator") return [...current.slice(0, -1), { kind: "operator", value }];
      // Končí číslem, třeba výsledkem „=“: počítá se s ním dál.
      return [...current, { kind: "operator", value }];
    });
  }

  /** Samotné číslo není výpočet — „=“ nad ním se nezapisuje. */
  function record() {
    if (result === null || settled || complete.length < 3) return;
    onCalculate({ expression: render(complete, ""), result });
  }

  function equals() {
    if (result === null) return;
    record();
    setSettled(true);
    setTokens([{ kind: "number", value: result }]);
    setPending("");
  }

  function backspace() {
    setSettled(false);
    if (pending !== "") {
      setPending((current) => current.slice(0, -1));
      return;
    }
    setTokens((current) => current.slice(0, -1));
  }

  function clear() {
    setSettled(false);
    setTokens([]);
    setPending("");
  }

  const expression = render(tokens, pending);

  return (
    <section className="app-chrome" aria-label={t("title")}>
      <div className="border-line mb-2 flex items-center gap-3 rounded-readout border py-1.5 pl-3 pr-1.5">
        <span className="min-w-0 flex-1">
          <span className="readout text-ink-soft block truncate text-label" data-numeric>
            {expression === "" ? t("empty") : expression}
          </span>
        </span>
        <output className="readout shrink-0 text-heading font-semibold" data-numeric>
          {result === null ? "—" : format(result)}
        </output>
        <button
          type="button"
          onClick={onClose}
          {...pressable}
          aria-label={t("close")}
          className="press text-ink-soft data-pressed:bg-surface-press flex size-11 shrink-0 items-center justify-center rounded-control"
        >
          <CloseIcon className="size-5" />
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <Key onPress={clear} ariaLabel={t("clear")} tone="edit">
          C
        </Key>
        <Key onPress={backspace} ariaLabel={tLesson("backspace")} tone="edit">
          <BackspaceIcon className="size-6" />
        </Key>
        <Key onPress={() => operator("/")} ariaLabel={t("divide")} tone="operator" bubble="÷">
          ÷
        </Key>
        <Key onPress={() => operator("*")} ariaLabel={t("multiply")} tone="operator" bubble="×">
          ×
        </Key>

        {["7", "8", "9"].map((key) => (
          <Key key={key} onPress={() => append(key)} bubble={key}>
            {key}
          </Key>
        ))}
        <Key onPress={() => operator("-")} ariaLabel={t("minus")} tone="operator" bubble="−">
          −
        </Key>

        {["4", "5", "6"].map((key) => (
          <Key key={key} onPress={() => append(key)} bubble={key}>
            {key}
          </Key>
        ))}
        <Key onPress={() => operator("+")} ariaLabel={t("plus")} tone="operator" bubble="+">
          +
        </Key>

        {["1", "2", "3"].map((key) => (
          <Key key={key} onPress={() => append(key)} bubble={key}>
            {key}
          </Key>
        ))}
        <Key onPress={equals} ariaLabel={t("equals")} tone="operator" className="row-span-2">
          =
        </Key>

        <Key onPress={() => append("0")} className="col-span-2" bubble="0" wide>
          0
        </Key>
        <Key onPress={() => append(",")} ariaLabel={tLesson("decimal")} bubble=",">
          ,
        </Key>
      </div>

      <button
        type="button"
        onClick={() => {
          if (result === null) return;
          record();
          onUse(format(Math.abs(result)));
        }}
        {...pressable}
        disabled={result === null}
        aria-label={negative ? t("useNegativeLabel", { value: format(-result) }) : undefined}
        className="press press-wide bg-accent data-pressed:bg-accent-press mt-2 flex min-h-13 w-full items-center justify-center gap-2.5 rounded-control text-body font-semibold text-on-accent disabled:opacity-40"
      >
        {negative ? (
          <>
            <span>
              {t.rich("useNegative", {
                value: format(-result),
                num: (chunks) => (
                  <span className="readout" data-numeric>
                    {chunks}
                  </span>
                ),
              })}
            </span>
            <span className="flex items-center gap-1 rounded-full bg-white/15 py-0.5 pl-1.5 pr-2 text-micro font-medium ring-1 ring-white/25 ring-inset">
              <PlusMinusIcon className="size-3.5" />
              {t("noMinus")}
            </span>
          </>
        ) : (
          t("use")
        )}
      </button>
    </section>
  );
}

/** Jeden dopočítaný výraz, jak ho student viděl na displeji. */
export type CalculatorEntry = { expression: string; result: number };

function Key({
  onPress,
  ariaLabel,
  tone = "digit",
  className = "",
  bubble,
  wide = false,
  children,
}: {
  onPress: () => void;
  ariaLabel?: string;
  tone?: "digit" | "operator" | "edit";
  className?: string;
  /** Znak v bublině nad prstem. Klávesy, jejichž účinek je vidět na displeji (C, ⌫, =), ji nemají. */
  bubble?: string;
  /** Klávesa přes dva sloupce: bublina zůstane úzká. */
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      {...pressable}
      aria-label={ariaLabel}
      className={`press ${LOOK[tone]} ${className} readout relative flex min-h-13 items-center justify-center rounded-control text-title font-medium`}
    >
      {children}
      {bubble === undefined ? null : (
        <span className={`key-bubble ${wide ? "key-bubble-wide" : ""}`} aria-hidden>
          <span>{bubble}</span>
        </span>
      )}
    </button>
  );
}

/**
 * Tři druhy kláves, ať se v mřížce 4 × 5 dá orientovat bez čtení:
 * číslice jsou plné, operace v jemné indigové, úpravy zápisu jen obrysem.
 */
const LOOK = {
  digit: "bg-surface text-ink data-pressed:bg-surface-press",
  operator: "bg-accent-wash text-accent-press data-pressed:bg-accent-wash-press",
  edit: "border-line text-ink-soft border data-pressed:border-surface-press data-pressed:bg-surface-press",
} as const;
