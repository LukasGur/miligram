import { Numeral } from "@/components/ui/Numeral";

/**
 * Zadání se zvýrazněnými hodnotami.
 *
 * Student v zadání nečte věty, hledá čísla — a pak je porovnává s tím, co
 * natype do odpovědi. Když jsou hodnoty ve stejném strojopisu jako displej,
 * oko je najde napoprvé a obrazovka drží pohromadě.
 *
 * Mezera mezi hodnotou a jednotkou zůstává běžným řezem: ve strojopisu má
 * i ona šířku znaku a „3 kg“ by se roztáhlo na „3  kg“.
 */
const VALUE = /(\d+(?:[.,]\d+)?)(\s?)((?:%|(?:mg|ml|g|l|kg|IU|mmol|mEq|µg|ng|min|h)(?:\/(?:kg|ml|m²|min|h|den|mol|l))*)\b)?/g;

export function Prompt({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;

  for (const match of text.matchAll(VALUE)) {
    const start = match.index ?? 0;
    const [whole, number, gap, unit] = match;
    if (start > last) parts.push(text.slice(last, start));

    parts.push(
      <span key={start} className="readout font-medium" data-numeric>
        <Numeral value={number} />
      </span>,
    );
    if (unit) {
      parts.push(gap);
      parts.push(
        <span key={`${start}-u`} className="readout font-medium">
          {unit}
        </span>,
      );
    } else if (gap) {
      parts.push(gap);
    }

    last = start + whole.length;
  }
  if (last < text.length) parts.push(text.slice(last));

  return <p className="text-body whitespace-pre-line">{parts}</p>;
}
