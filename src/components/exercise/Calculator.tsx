"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { BackspaceIcon, CloseIcon } from "@/components/icons";
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
 */
export function Calculator({
  onUse,
  onClose,
}: {
  /** Převezme výsledek do odpovědi a zavře kalkulačku. */
  onUse: (value: string) => void;
  onClose: () => void;
}) {
  const t = useTranslations("calculator");
  const tLesson = useTranslations("lesson");
  const [tokens, setTokens] = useState<Token[]>([]);
  const [pending, setPending] = useState("");

  const complete: Token[] = (() => {
    const value = parse(pending);
    return value === null ? tokens : [...tokens, { kind: "number", value }];
  })();
  const result = evaluate(complete);

  function append(character: string) {
    setPending((current) => {
      if (character === "," && current.includes(",")) return current;
      if (current === "0" && character !== ",") return character;
      return current + character;
    });
  }

  function operator(value: Operator) {
    const number = parse(pending);
    if (number !== null) {
      setTokens((current) => [...current, { kind: "number", value: number }, { kind: "operator", value }]);
      setPending("");
      return;
    }
    // Zápis končí operátorem: student si to rozmyslel, vyměníme ho.
    setTokens((current) =>
      current.length > 0 && current[current.length - 1].kind === "operator"
        ? [...current.slice(0, -1), { kind: "operator", value }]
        : current,
    );
  }

  function equals() {
    if (result === null) return;
    setTokens([{ kind: "number", value: result }]);
    setPending("");
  }

  function backspace() {
    if (pending !== "") {
      setPending((current) => current.slice(0, -1));
      return;
    }
    setTokens((current) => current.slice(0, -1));
  }

  function clear() {
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
        <Key onPress={() => operator("/")} ariaLabel={t("divide")} tone="operator">
          ÷
        </Key>
        <Key onPress={() => operator("*")} ariaLabel={t("multiply")} tone="operator">
          ×
        </Key>

        {["7", "8", "9"].map((key) => (
          <Key key={key} onPress={() => append(key)}>
            {key}
          </Key>
        ))}
        <Key onPress={() => operator("-")} ariaLabel={t("minus")} tone="operator">
          −
        </Key>

        {["4", "5", "6"].map((key) => (
          <Key key={key} onPress={() => append(key)}>
            {key}
          </Key>
        ))}
        <Key onPress={() => operator("+")} ariaLabel={t("plus")} tone="operator">
          +
        </Key>

        {["1", "2", "3"].map((key) => (
          <Key key={key} onPress={() => append(key)}>
            {key}
          </Key>
        ))}
        <Key onPress={equals} ariaLabel={t("equals")} tone="operator" className="row-span-2">
          =
        </Key>

        <Key onPress={() => append("0")} className="col-span-2">
          0
        </Key>
        <Key onPress={() => append(",")} ariaLabel={tLesson("decimal")}>
          ,
        </Key>
      </div>

      <button
        type="button"
        onClick={() => result !== null && onUse(format(result))}
        {...pressable}
        disabled={result === null}
        className="press press-wide bg-accent data-pressed:bg-accent-press mt-2 flex min-h-13 w-full items-center justify-center rounded-control text-body font-semibold text-white disabled:opacity-40"
      >
        {t("use")}
      </button>
    </section>
  );
}

function Key({
  onPress,
  ariaLabel,
  tone = "digit",
  className = "",
  children,
}: {
  onPress: () => void;
  ariaLabel?: string;
  tone?: "digit" | "operator" | "edit";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      {...pressable}
      aria-label={ariaLabel}
      className={`press ${LOOK[tone]} ${className} readout flex min-h-13 items-center justify-center rounded-control text-title font-medium`}
    >
      {children}
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
