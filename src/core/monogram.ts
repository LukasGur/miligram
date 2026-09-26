/**
 * Monogram: iniciály a tón z přezdívky.
 *
 * Fotky se nenahrávají — bez nich není co moderovat a není co chránit.
 * Tón se z přezdívky odvozuje stabilně, takže kamarád má na každém
 * telefonu tutéž barvu a nikdo ji nemusí nastavovat.
 */

/** Počet tónů. Musí souhlasit s `--color-tone-*` v globals.css. */
export const TONES = 8;

/**
 * Dvě písmena. Přezdívka s oddělovačem dá první písmena dvou částí
 * (jana_k → JK), jinak první dvě písmena (eva → EV).
 */
export function initials(handle: string): string {
  const parts = handle
    .toLowerCase()
    .split(/[_.\-\s]+/)
    .filter((part) => /[a-z0-9]/.test(part));
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  const only = (parts[0] ?? handle).replace(/[^a-z0-9]/gi, "");
  return (only.slice(0, 2) || "?").toUpperCase();
}

/** Tón 0 až TONES−1. FNV-1a: krátké a na přezdívkách dost rozptýlené. */
export function toneOf(handle: string): number {
  let hash = 0x811c9dc5;
  for (const character of handle.toLowerCase()) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash % TONES;
}
