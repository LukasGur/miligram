/**
 * Doběh čísla.
 *
 * Krátká odměna na konci lekce: číslo naskočí od nuly k výsledku. Běží
 * v prohlížeči jako animace vlastní vlastnosti, takže nepotřebuje časovač
 * ani překreslování — a při vypnutém pohybu se rovnou ukáže cílová hodnota.
 *
 * Odečítači obrazovky se hodnota podává textem, protože obsah vytvořený
 * přes `content:` se nedá spolehlivě přečíst.
 */
export function Tally({ value, prefix = "" }: { value: number; prefix?: string }) {
  return (
    <span className="readout" data-numeric>
      {prefix}
      <span className="tally" aria-hidden style={{ "--tally-target": value } as React.CSSProperties} />
      <span className="sr-only">{value}</span>
    </span>
  );
}
