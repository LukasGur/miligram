"use client";

import { useId, useRef, useState } from "react";

/**
 * Pole pro kód z e-mailu.
 *
 * Vypadá jako šest políček, ale je to jedno obyčejné <input>. Jen tak
 * zůstane všechno, co kód z e-mailu dělá pohodlným: iOS nabídne kód nad
 * klávesnicí (autocomplete="one-time-code"), vložení ze schránky projde
 * najednou a odečítač obrazovky čte jedno pole s popiskem. Políčka pod
 * ním jsou jen obraz jeho hodnoty.
 *
 * Záměrně se nepodobá poli pro e-mail: tam se píše, tady se opisuje
 * z jiné aplikace. Kdo dostane stejně vypadající pole, snadno přehlédne,
 * že se po něm chce něco jiného než adresa.
 */
export function CodeInput({
  label,
  value,
  onChange,
  length,
  invalid,
  pending,
  attempt,
  describedBy,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  length: number;
  /** Kód nesedí — políčka se obarví a zavrtí. */
  invalid?: boolean;
  /** Kód se právě ověřuje. */
  pending?: boolean;
  /**
   * Pořadí neúspěšného pokusu. Změna klíče spustí zavrtění znovu,
   * i když je chyba stejná jako minule.
   */
  attempt?: number;
  /** Id chybové hlášky, kterou má odečítač přečíst spolu s polem. */
  describedBy?: string;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);

  // Kurzor stojí vždy na konci — políčka neumí ukázat, že je uprostřed.
  function toEnd() {
    const element = input.current;
    if (element) element.setSelectionRange(element.value.length, element.value.length);
  }

  const active = Math.min(value.length, length - 1);
  const half = Math.ceil(length / 2);

  return (
    <div>
      <label htmlFor={id} className="panel-label">
        {label}
      </label>

      <div className="relative mt-2">
        {/* Klíč jen na políčkách: pole samo se po chybě nesmí vytvořit
            znovu, jinak by na iPhonu problikla klávesnice. */}
        <div key={attempt} className={`flex items-stretch justify-center ${invalid ? "animate-shake" : ""}`}>
          {Array.from({ length }, (_, index) => {
            const digit = value[index];
            const isActive = focused && !pending && index === active && value.length < length;
            const state = invalid
              ? "border-danger bg-danger-wash text-danger"
              : pending
                ? "animate-pending border-accent bg-paper"
                : isActive
                  ? "border-accent bg-paper shadow-[0_0_0_4px_var(--color-accent-wash)]"
                  : digit
                    ? "border-ink/25 bg-paper"
                    : "border-transparent bg-surface";

            return (
              <div
                key={index}
                aria-hidden
                className={`readout relative flex h-16 max-w-14 flex-1 items-center justify-center rounded-control border-2 text-title font-medium transition-[border-color,background-color,box-shadow] duration-150 ${state} ${
                  index === half ? "ml-3" : index > 0 ? "ml-1.5" : ""
                }`}
              >
                {digit ? (
                  <span key={digit + index} className="animate-tick">
                    {digit}
                  </span>
                ) : isActive ? (
                  <span className="animate-caret bg-accent h-7 w-0.5 rounded-full" />
                ) : (
                  <span className="bg-ink-soft/30 h-0.5 w-3 rounded-full" />
                )}
              </div>
            );
          })}
        </div>

        <input
          ref={input}
          id={id}
          value={value}
          onChange={(event) => {
            /* Po špatném kódu jsou políčka plná. Další číslice by se
               nevešla a pole by odeslalo tentýž kód znovu — proto
               začne kód od začátku a vložený nový kód nahradí starý. */
            const next = event.target.value;
            const appended = next.length > value.length && next.startsWith(value);
            const restart = invalid && value.length >= length && appended;
            onChange(restart ? next.slice(value.length) : next);
          }}
          onFocus={() => { setFocused(true); requestAnimationFrame(toEnd); }}
          onBlur={() => setFocused(false)}
          onSelect={toEnd}
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="one-time-code"
          autoFocus
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          aria-busy={pending || undefined}
          /* Průhledné, ale ne neviditelné: s opacity 0 iOS občas
             odmítne pole zaměřit a nenabídne kód. Písmo 16 px, jinak
             Safari při zaměření zvětší stránku. */
          className="absolute inset-0 h-full w-full cursor-text bg-transparent text-base text-transparent caret-transparent outline-none selection:bg-transparent selection:text-transparent"
        />
      </div>
    </div>
  );
}
