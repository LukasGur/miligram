/**
 * Odečet hodnoty.
 *
 * Číslo strojopisem, jednotka drobně vedle, popisek verzálkami nad tím —
 * tvar, který má každý přístroj na panelu. Používá se všude, kde se něco
 * měří: statistiky, pole odpovědi, výsledek.
 */
import { Numeral } from "./Numeral";

export function Readout({
  label,
  value,
  unit,
  size = "medium",
  tone = "normal",
}: {
  label?: string;
  value: string;
  unit?: string;
  size?: "small" | "medium" | "large";
  tone?: "normal" | "accent" | "danger" | "muted";
}) {
  const valueSize =
    size === "large" ? "text-display" : size === "medium" ? "text-title" : "text-heading";
  const unitSize = size === "large" ? "text-heading" : "text-label";
  const color =
    tone === "accent"
      ? "text-accent"
      : tone === "danger"
        ? "text-danger"
        : tone === "muted"
          ? "text-ink-soft"
          : "text-ink";

  return (
    <div>
      {label ? <p className="panel-label">{label}</p> : null}
      <p className={`readout ${valueSize} ${color} mt-0.5 font-semibold`} data-numeric>
        <Numeral value={value} />
        {unit ? <span className={`text-ink-soft ml-1.5 ${unitSize} font-normal`}>{unit}</span> : null}
      </p>
    </div>
  );
}
