/**
 * Číslo se sevřenou desetinnou čárkou.
 *
 * Strojopis dává každému znaku stejnou šířku, takže čárka dostane celou
 * buňku a „0,20“ se čte jako „0 , 20“. U hodnoty, která má být dávka léku,
 * je taková mezera matoucí. Oddělovač proto dostane užší buňku — číslice
 * zůstávají tabulkové, stáhne se jen on. Totéž platí pro lomítko
 * ve výsledku „5/7“.
 */
export function Numeral({ value }: { value: string }) {
  const match = value.match(/^(.*?)([.,/])(.*)$/);
  if (!match) return <>{value}</>;

  const [, head, separator, tail] = match;
  return (
    <>
      {head}
      <span
        className={`inline-block text-center ${
          separator === "/" ? "text-ink-soft w-[0.5em]" : "w-[0.34em]"
        }`}
      >
        {separator}
      </span>
      {tail}
    </>
  );
}
