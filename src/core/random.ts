/**
 * Deterministický generátor náhodných hodnot.
 *
 * Příklad je jednoznačně určený dvojicí (šablona, semínko). Díky tomu jde
 * tentýž příklad znovu sestavit při opakování chyby, poslat protihráči
 * v souboji a otestovat, aniž bychom ukládali celé zadání.
 */

export type Rng = {
  /** Číslo v <0, 1). */
  next(): number;
  /** Celé číslo v <min, max>. */
  int(min: number, max: number): number;
  /** Číslo v <min, max> zaokrouhlené na násobek kroku. */
  step(min: number, max: number, step: number): number;
  pick<T>(items: readonly T[]): T;
};

/** Deterministický 32bitový hash řetězce (varianta FNV-1a). */
export function seedFrom(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32 — malý, rychlý, s dostatečnou kvalitou pro losování zadání. */
export function createRng(seed: number | string): Rng {
  let state = (typeof seed === "string" ? seedFrom(seed) : seed) >>> 0;

  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    int(min, max) {
      if (max < min) throw new Error("Horní mez nesmí být menší než dolní.");
      return min + Math.floor(next() * (max - min + 1));
    },
    step(min, max, step) {
      if (step <= 0) throw new Error("Krok musí být kladný.");
      if (max < min) throw new Error("Horní mez nesmí být menší než dolní.");
      const steps = Math.floor((max - min) / step + 1e-9);
      const value = min + this.int(0, steps) * step;
      // Násobení a sčítání v plovoucí čárce zanechává zbytky typu 0,30000000000000004.
      const decimals = (String(step).split(".")[1] ?? "").length;
      return Number(value.toFixed(decimals));
    },
    pick(items) {
      if (items.length === 0) throw new Error("Nelze losovat z prázdného seznamu.");
      return items[this.int(0, items.length - 1)];
    },
  };
}
