/**
 * Počítání s veličinami tak, jak je šablony sázejí do kroků řešení.
 *
 * Jen pro testy. Kroky jsou LaTeXové řetězce a nikde jinde se znovu
 * nepočítají — kdyby v dosazení stálo g/l ÷ g/mol a vedle toho mmol/l,
 * nic by si toho nevšimlo. Tenhle parser zná jen tu podmnožinu LaTeXu,
 * kterou šablony opravdu píšou; na cokoli jiného odpoví chybou, aby nový
 * zápis nezůstal potichu nezkontrolovaný.
 */

const BASES = ["mass", "volume", "time", "amount", "activity", "length"] as const;
type Base = (typeof BASES)[number];

export type Dimension = Readonly<Record<Base, number>>;
export type Quantity = { value: number; dim: Dimension };

const NONE: Dimension = { mass: 0, volume: 0, time: 0, amount: 0, activity: 0, length: 0 };

/** Faktor vůči základu: mg, ml, min, mmol, IU, cm — stejný jako v `units.ts`. */
const UNIT_TABLE: Record<string, { factor: number; base?: Base }> = {
  ng: { factor: 1e-6, base: "mass" },
  "µg": { factor: 1e-3, base: "mass" },
  mg: { factor: 1, base: "mass" },
  g: { factor: 1e3, base: "mass" },
  kg: { factor: 1e6, base: "mass" },
  ml: { factor: 1, base: "volume" },
  dl: { factor: 100, base: "volume" },
  l: { factor: 1e3, base: "volume" },
  s: { factor: 1 / 60, base: "time" },
  min: { factor: 1, base: "time" },
  h: { factor: 60, base: "time" },
  "µmol": { factor: 1e-3, base: "amount" },
  mmol: { factor: 1, base: "amount" },
  mol: { factor: 1e3, base: "amount" },
  // Ekvivalent se od milimolu liší mocenstvím, a to v dosazení stojí
  // zvlášť jako „× 2 mEq/mmol“. Rozměrově jsou to tedy stejné jednotky.
  mEq: { factor: 1, base: "amount" },
  IU: { factor: 1, base: "activity" },
  cm: { factor: 1, base: "length" },
  m: { factor: 100, base: "length" },
  // Procento je v šablonách počet procent, ne podíl: „5,85 × 10 mg/ml“
  // i „400/400 × 100 = 100 %“. Počítá se s ním proto jako s označením.
  "%": { factor: 1 },
  /**
   * Kusy a četnosti. Tableta, kapka nebo „denně“ nejsou fyzikální rozměr —
   * 200 mg ÷ 100 mg/tbl jsou dvě tablety a denní dávka v mg/kg/den krát
   * kilogramy je prostě dávka na den, kterou krok nazývá denní.
   */
  tbl: { factor: 1 },
  gtt: { factor: 1 },
  "@day": { factor: 1 },
  "@days": { factor: 1 },
  "@cycle": { factor: 1 },
  "@cycles": { factor: 1 },
  amp: { factor: 1 },
  "@packShort": { factor: 1 },
};

function scaled(dim: Dimension, by: number): Dimension {
  return Object.fromEntries(BASES.map((b) => [b, dim[b] * by])) as Dimension;
}

function combined(a: Dimension, b: Dimension, sign: 1 | -1): Dimension {
  return Object.fromEntries(BASES.map((k) => [k, a[k] + sign * b[k]])) as Dimension;
}

export function sameDimension(a: Dimension, b: Dimension): boolean {
  return BASES.every((k) => Math.abs(a[k] - b[k]) < 1e-9);
}

export function describeDimension(dim: Dimension): string {
  const parts = BASES.filter((k) => dim[k] !== 0).map((k) => (dim[k] === 1 ? k : `${k}^${dim[k]}`));
  return parts.length ? parts.join("·") : "bez rozměru";
}

/**
 * Jednotka jako „mg/kg/@day“, „mg/ml\cdot min“ nebo „mmol/l na 1 IU“.
 * Čte se zleva doprava: a/b·c je (a/b)·c, jak se AUC v mg/ml·min píše.
 */
export function parseUnit(raw: string): Quantity {
  const text = raw
    .replace(/^\\text\{(.*)\}$/, "$1")
    .replaceAll("\\mu ", "µ")
    .replaceAll("\\mu", "µ")
    .replaceAll("\\%", "%")
    .replaceAll("\\ na\\ 1\\ ", "/")
    .replaceAll("\\cdot", "·")
    .replaceAll("\\ ", "")
    .replaceAll(" ", "");
  let value = 1;
  let dim = NONE;
  let sign: 1 | -1 = 1;
  for (const token of text.split(/([/·])/)) {
    if (token === "/") { sign = -1; continue; }
    if (token === "·") { sign = 1; continue; }
    if (token === "") continue;
    const [symbol, power = "1"] = token.split("^");
    const def = UNIT_TABLE[symbol];
    if (!def) throw new Error(`Neznámá jednotka „${symbol}“ v „${raw}“`);
    const exponent = Number(power) * sign;
    value *= def.factor ** exponent;
    if (def.base) dim = combined(dim, scaled({ ...NONE, [def.base]: 1 }, exponent), 1);
    sign = 1;
  }
  return { value, dim };
}

/* ---------------------------------------------------------------------- */

class Parser {
  private pos = 0;
  constructor(
    private readonly src: string,
    private readonly ignoreUnits: boolean,
  ) {}

  parse(): Quantity {
    const value = this.sum();
    this.skip();
    if (this.pos < this.src.length) this.fail("nečekaný zbytek");
    return value;
  }

  private fail(why: string): never {
    throw new Error(`${why} na pozici ${this.pos}: „${this.src.slice(this.pos, this.pos + 30)}“ v „${this.src}“`);
  }

  private skip() {
    for (;;) {
      const rest = this.src.slice(this.pos);
      const ws = /^(?:\s+|\\[,;:!]|\\ |\\quad)/.exec(rest);
      if (!ws) return;
      this.pos += ws[0].length;
    }
  }

  private eat(literal: string): boolean {
    this.skip();
    if (this.src.startsWith(literal, this.pos)) {
      this.pos += literal.length;
      return true;
    }
    return false;
  }

  private expect(literal: string) {
    if (!this.eat(literal)) this.fail(`čekal jsem „${literal}“`);
  }

  private sum(): Quantity {
    let left = this.product();
    for (;;) {
      const plus = this.eat("+");
      if (!plus && !this.eat("-")) return left;
      const right = this.product();
      if (!sameDimension(left.dim, right.dim)) {
        this.fail(`sčítání různých rozměrů (${describeDimension(left.dim)} a ${describeDimension(right.dim)})`);
      }
      left = { value: plus ? left.value + right.value : left.value - right.value, dim: left.dim };
    }
  }

  private product(): Quantity {
    let left = this.factor();
    while (this.eat("\\times")) {
      const right = this.factor();
      left = { value: left.value * right.value, dim: combined(left.dim, right.dim, 1) };
    }
    return left;
  }

  private group(): Quantity {
    this.expect("{");
    const inner = this.sum();
    this.expect("}");
    return inner;
  }

  private factor(): Quantity {
    this.skip();
    if (this.eat("\\dfrac")) {
      const top = this.group();
      const bottom = this.group();
      return { value: top.value / bottom.value, dim: combined(top.dim, bottom.dim, -1) };
    }
    if (this.eat("\\sqrt")) {
      const inner = this.group();
      return { value: Math.sqrt(inner.value), dim: scaled(inner.dim, 0.5) };
    }
    if (this.eat("\\left\\lceil")) {
      const inner = this.sum();
      this.expect("\\right\\rceil");
      return { value: Math.ceil(inner.value - 1e-9), dim: inner.dim };
    }
    if (this.eat("\\left\\lfloor")) {
      const inner = this.sum();
      this.expect("\\right\\rfloor");
      return { value: Math.floor(inner.value + 1e-9), dim: inner.dim };
    }
    if (this.eat("\\min(")) {
      const a = this.sum();
      this.expect(",");
      const b = this.sum();
      this.expect(")");
      if (!sameDimension(a.dim, b.dim)) this.fail("minimum z různých rozměrů");
      return a.value <= b.value ? a : b;
    }
    if (this.eat("\\left(") || this.eat("(")) {
      const inner = this.sum();
      if (!this.eat("\\right)")) this.expect(")");
      return inner;
    }
    return this.number();
  }

  private number(): Quantity {
    this.skip();
    const match = /^\d+(?:\{,\}\d+)?/.exec(this.src.slice(this.pos));
    if (!match) this.fail("čekal jsem číslo");
    this.pos += match[0].length;
    const value = Number(match[0].replace("{,}", "."));

    // Jednotka hned za číslem: \,\mathrm{mg}, \ \mathrm{mmol/l}, \,\text{mg/kg/@day},
    // \,\% a volitelné pokračování \text{/ml}, jak ho píšou šablony s IU.
    const rest = this.src.slice(this.pos);
    const unitMatch = /^(?:\\,|\\ |\s)*(?:\\(?:mathrm|text)\{((?:[^{}]|\{[^{}]*\})*)\}|\\%)(?:\\text\{(\/[^{}]*)\})?/.exec(rest);
    if (!unitMatch) return { value, dim: NONE };
    this.pos += unitMatch[0].length;
    const symbol = (unitMatch[1] ?? "\\%") + (unitMatch[2] ?? "");
    if (symbol.trim() === "" || this.ignoreUnits) return { value, dim: NONE };
    const u = parseUnit(symbol);
    return { value: value * u.value, dim: u.dim };
  }
}

/** `ignoreUnits` počítá jen se zobrazenými čísly — pro empirické vzorce. */
export function evaluate(latex: string, ignoreUnits = false): Quantity {
  return new Parser(latex, ignoreUnits).parse();
}

/** Rozdělí na „=“ mimo složené závorky. */
export function splitEquals(latex: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < latex.length; i++) {
    const ch = latex[i];
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    else if (ch === "=" && depth === 0) {
      parts.push(latex.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(latex.slice(start));
  return parts.map((p) => p.trim());
}

/**
 * Levá strana jako „V“, „c_n“, „\text{ml/h}“ nebo „m_{\text{@day}}“ —
 * označení veličiny, ne hodnota. Pozná se tím, že v ní po odstranění
 * indexů a textu nezbude žádná číslice.
 */
export function isSymbolic(segment: string): boolean {
  const stripped = segment
    .replace(/_\{(?:[^{}]|\{[^{}]*\})*\}/g, "")
    .replace(/_\w/g, "")
    .replace(/\\text\{[^{}]*\}/g, "")
    .replace(/\\mathrm\{[^{}]*\}/g, "");
  return !/\d/.test(stripped);
}
