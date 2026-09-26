/**
 * Výpočet zadaný v kalkulačce.
 *
 * Vlastní, ne `eval`: vstup sice píše jen naše klávesnice, ale počítadlo,
 * kterému se dá podstrčit řetězec, je zbytečné riziko a špatný zvyk.
 *
 * Násobení a dělení mají přednost před sčítáním a odčítáním. Zleva doprava
 * by u zápisu jako `14,9 ÷ 74,5 × 1000` vyšlo totéž, ale u `2 + 3 × 4` ne —
 * a student, který si výpočet rozepíše, čeká školní pořadí.
 */
export type Operator = "+" | "-" | "*" | "/";

export type Token = { kind: "number"; value: number } | { kind: "operator"; value: Operator };

/** Výsledek, nebo `null`, když zápis nedává smysl (třeba dělení nulou). */
export function evaluate(tokens: readonly Token[]): number | null {
  if (tokens.length === 0) return null;
  if (tokens[tokens.length - 1].kind === "operator") return null;

  const values: number[] = [];
  const operators: Operator[] = [];

  for (const [index, token] of tokens.entries()) {
    // Mezi dvěma čísly musí stát operátor. Bez něj by výsledek tiše
    // spolkl jedno z nich a student by neměl jak poznat proč.
    if (index > 0 && token.kind === tokens[index - 1].kind) return null;
    if (token.kind === "number") {
      const previous = operators[operators.length - 1];
      if (previous === "*" || previous === "/") {
        operators.pop();
        const left = values.pop();
        if (left === undefined) return null;
        if (previous === "/" && token.value === 0) return null;
        values.push(previous === "*" ? left * token.value : left / token.value);
      } else {
        values.push(token.value);
      }
      continue;
    }
    operators.push(token.value);
  }

  let result = values[0];
  for (const [index, operator] of operators.entries()) {
    const right = values[index + 1];
    if (right === undefined) return null;
    result = operator === "+" ? result + right : result - right;
  }

  return Number.isFinite(result) ? result : null;
}

/**
 * Zápis, jak se ukáže na displeji. Čísla zůstávají tak, jak je student
 * napsal — přepisovat mu je pod rukou by bylo matoucí.
 */
export function render(tokens: readonly Token[], pending: string): string {
  const parts = tokens.map((token) =>
    token.kind === "number" ? format(token.value) : SYMBOLS[token.value],
  );
  if (pending !== "") parts.push(pending);
  return parts.join(" ");
}

const SYMBOLS: Record<Operator, string> = { "+": "+", "-": "−", "*": "×", "/": "÷" };

/** Číslo s desetinnou čárkou a bez oddělovače tisíců, ať jde přepsat do odpovědi. */
export function format(value: number): string {
  return String(Number(value.toPrecision(12))).replace(".", ",");
}

/** Text z klávesnice na číslo. Prázdný nebo rozepsaný zápis je `null`. */
export function parse(text: string): number | null {
  if (text === "" || text === "," || text === "-") return null;
  const value = Number(text.replace(",", "."));
  return Number.isFinite(value) ? value : null;
}
