/**
 * Zadání se zvýrazněnými hodnotami.
 *
 * Student v zadání nečte věty, hledá čísla — a pak je porovnává s tím, co
 * natype do odpovědi. Hodnoty proto stojí polotučně a s tabulkovými
 * číslicemi, ale ve stejném písmu jako věta: strojopis uprostřed textu
 * nutil oko přeskakovat mezi dvěma řezy a desetinná čárka v něm dostávala
 * celou buňku („5 ,85“).
 *
 * Hodnota i s jednotkou drží pohromadě. Zalomit „2,925 mg/ml“ za čárkou
 * je u dávky horší než delší řádek.
 */
const VALUE =
  /(\d{1,3}(?:[  ]\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?)(\s?)((?:%|×|(?:mg|ml|g|l|kg|IU|mmol|mEq|µg|ng|min|h)(?:\/(?:kg|ml|m²|min|h|den|mol|l))*)(?![\p{L}\d]))?/gu;

/** Náboj iontu jako horní index: Na+ → Na⁺, Cl- → Cl⁻. */
const ION = /\b([A-Z][a-z]?\d?)([+-])(?=[\s.,?!]|$)/g;
const CHARGE: Record<string, string> = { "+": "⁺", "-": "⁻" };

export function Prompt({ text }: { text: string }) {
  const paragraphs = text.replace(ION, (_, ion: string, sign: string) => ion + CHARGE[sign]).split(/\n{2,}/);
  // Poslední odstavec je otázka. Kontext se čte, otázka se hledá —
  // proto se od něj oddělí, když je víc než jeden.
  const question = paragraphs.length > 1 ? paragraphs.pop() : undefined;

  return (
    <div className="text-prompt">
      {paragraphs.map((paragraph, index) => (
        <p key={index} className={`whitespace-pre-line ${index > 0 ? "mt-3" : ""}`}>
          {highlight(paragraph)}
        </p>
      ))}
      {question ? (
        <p className="border-accent mt-5 border-l-[3px] pl-3 text-heading font-semibold whitespace-pre-line">
          {highlight(question)}
        </p>
      ) : null}
    </div>
  );
}

function highlight(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let last = 0;

  for (const match of text.matchAll(VALUE)) {
    const start = match.index ?? 0;
    const [whole, number, gap, unit] = match;
    if (start > last) parts.push(text.slice(last, start));

    // Bez jednotky zůstane mezera za číslem obyčejná, ať se věta může zalomit.
    parts.push(
      <span key={start} className="num font-semibold whitespace-nowrap" data-numeric>
        {unit ? `${number}${gap}${unit}` : number}
      </span>,
    );
    if (!unit && gap) parts.push(gap);

    last = start + whole.length;
  }
  if (last < text.length) parts.push(text.slice(last));

  return parts;
}
