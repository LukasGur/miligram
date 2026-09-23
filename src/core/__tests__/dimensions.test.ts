import { describe, expect, it } from "vitest";
import "../templates";
import { allTemplates, buildExercise } from "../templates";
import { DIFFICULTIES, type SolutionStep } from "../types";
import { describeDimension, evaluate, isSymbolic, labeledNumbers, sameDimension, splitEquals, type Quantity } from "./latexQuantity";

const SEEDS = Array.from({ length: 12 }, (_, i) => `r${i}`);

/**
 * Empirické vzorce, ve kterých konstanty nesou skrytý rozměr: Mosteller
 * (√(cm × kg / 3600) dá m²), Cockcroft–Gault (věk v letech, kreatinin
 * v mg/dl) a převod kreatininu přes jeho molární hmotnost. Tady se hlídá
 * jen číslo, rozměr dosazení s výsledkem z principu nesedí.
 */
const EMPIRICAL = new Set(["C1/dosazeni", "C3/povrchTela", "J1/prevodKreatininu", "J1/dosazeni"]);

/** Hodnoty, které krok ukazuje: segmenty oddělené „=“ kromě označení veličiny. */
function values(latex: string): string[] {
  return splitEquals(latex).filter((segment) => !isSymbolic(segment));
}

/** Krok jako „7,45 mg/ml = 7,45 g/l“: rovnost je celá v něm, na nic dalšího nenavazuje. */
function selfContained(step: SolutionStep): boolean {
  return !step.result && !!step.substituted && values(step.substituted).length > 1;
}

/**
 * Kam má dosazení bez vlastního mezivýsledku dojít: k prvnímu dalšímu
 * kroku s hodnotou. Samostatné rovnosti se přeskakují — v I2 za dosazením
 * stojí srovnání s jinou koncentrací, a to s výsledkem nesouvisí.
 */
function nextValue(steps: SolutionStep[], from: number): string | undefined {
  for (let i = from + 1; i < steps.length; i++) {
    if (selfContained(steps[i])) continue;
    const candidate = steps[i].substituted ?? steps[i].result;
    if (candidate) return values(candidate)[0];
  }
  return undefined;
}

function decimalsOf(latex: string): number {
  const match = /\d+\{,\}(\d+)/.exec(latex);
  return match ? match[1].length : 0;
}

/**
 * Shoda s tolerancí na zaokrouhlení. Dosazují se už zaokrouhlená čísla,
 * takže přesná rovnost platit nemusí — ale řádová chyba nebo zapomenutý
 * převod se do procenta a půl nevejde nikdy.
 */
function close(actual: Quantity, expected: Quantity, expectedLatex: string): boolean {
  // Půl posledního zobrazeného místa, přepočtená do základní jednotky.
  const shown = Number(/\d+(?:\{,\}\d+)?/.exec(expectedLatex)?.[0].replace("{,}", "."));
  const toBase = shown ? Math.abs(expected.value / shown) : 1;
  const halfDigit = 0.5 * 10 ** -decimalsOf(expectedLatex) * toBase;
  const diff = Math.abs(actual.value - expected.value);
  return diff <= Math.max(Math.abs(expected.value) * 0.015, halfDigit * (1 + 1e-9));
}

/**
 * „300 mg“ bez jakékoli operace. Rovnost „300 mg = 0,3 g“ je vyslovený
 * převod jednotek — ten čísla měnit smí, protože ho student vidí.
 */
function isSingleNumber(latex: string): boolean {
  return (latex.match(/\d+(?:\{,\}\d+)?/g) ?? []).length === 1;
}

type Finding = { id: string; problem: string };

function checkStep(id: string, key: string, steps: SolutionStep[], index: number): Finding[] {
  const step = steps[index];
  if (!step.substituted) return [];
  const where = `${id}/${step.textKey}`;
  const found: Finding[] = [];

  const chain = values(step.substituted);
  const target = step.result ? values(step.result)[0] : selfContained(step) ? undefined : nextValue(steps, index);
  if (target) chain.push(target);

  const empirical = EMPIRICAL.has(key);
  let quantities: Quantity[];
  let shown: Quantity[];
  try {
    quantities = chain.map((latex) => evaluate(latex, empirical));
    shown = chain.map((latex) => evaluate(latex, true));
  } catch (error) {
    return [{ id: where, problem: (error as Error).message }];
  }

  for (let i = 1; i < quantities.length; i++) {
    const [a, b] = [quantities[i - 1], quantities[i]];
    const pair = `${chain[i - 1]}  =  ${chain[i]}`;
    if (!sameDimension(a.dim, b.dim)) {
      found.push({ id: where, problem: `rozměr ${describeDimension(a.dim)} ≠ ${describeDimension(b.dim)}: ${pair}` });
    } else if (!close(a, b, chain[i])) {
      found.push({ id: where, problem: `hodnota ${a.value} ≠ ${b.value}: ${pair}` });
    } else if (!isSingleNumber(chain[i - 1]) && !close(shown[i - 1], shown[i], chain[i])) {
      // S jednotkami to sedí, ale čísla na obrazovce na kalkulačce nevyjdou:
      // převod proběhl potichu. Přesně tohle bylo v H6 — 2,925 ÷ 58,5 je
      // 0,05, ne 50, a tisícovka z mol na mmol v postupu chyběla.
      found.push({ id: where, problem: `skrytý převod, čísla dají ${shown[i - 1].value}, ne ${shown[i].value}: ${pair}` });
    }
  }
  return found;
}

function everyExercise() {
  return allTemplates().flatMap((template) =>
    DIFFICULTIES.flatMap((difficulty) =>
      SEEDS.map((seed) => ({ template, id: `${template.id}/${difficulty}/${seed}`, ex: buildExercise(template.id, seed, difficulty) })),
    ),
  );
}

/**
 * Každé dosazení se přepočítá i s jednotkami a porovná s tím, co krok
 * ukazuje jako výsledek. Tahle kontrola vznikla po H6, kde zlomek
 * g/l ÷ g/mol vedl rovnou na mmol/l — číslo bylo tisíckrát jinde,
 * než kam dosazení ve skutečnosti vede, a převod v postupu chyběl.
 */
describe("rozměry v krocích řešení", () => {
  const exercises = everyExercise();

  it("dosazení vede na mezivýsledek se stejnou hodnotou i jednotkou", () => {
    const findings = new Map<string, string>();
    for (const { template, id, ex } of exercises) {
      ex.solution.steps.forEach((step, index) => {
        for (const f of checkStep(id, `${template.id}/${step.textKey}`, ex.solution.steps, index)) {
          const key = `${f.id.split("/")[0]}/${f.id.split("/").at(-1)}`;
          if (!findings.has(key)) findings.set(key, `${f.id}: ${f.problem}`);
        }
      });
    }
    expect([...findings.values()]).toEqual([]);
  });

  it("přeznačení jednotky se stejným číslem stojí v postupu jako vlastní krok", () => {
    // 74,5 g/mol a 74,5 mg/mmol jsou totéž, ale jen pro toho, kdo ví proč.
    // H2 zadala M v g/mol a v dosazení bez vysvětlení dělila mg/mmol —
    // student vydělil 447 mg číslem 74,5, vzal výsledek jako mol a odpověděl
    // 6000 mmol. Když se číslo z dřívějšího kroku objeví v jiné jednotce,
    // musí někde stát obě podoby vedle sebe.
    const normalize = (unit: string) => unit.replaceAll("\\mu ", "µ").replaceAll(" ", "");
    const findings = new Map<string, string>();
    for (const { template, id, ex } of exercises) {
      const texts = ex.solution.steps.map((s) =>
        [s.formula, s.substituted, s.result].filter((l): l is string => !!l),
      );
      const labels = texts.map((list) => list.flatMap(labeledNumbers));
      labels.forEach((current, index) => {
        const earlier = labels.slice(0, index).flat();
        for (const later of current) {
          const before = earlier.find(
            // Táž hodnota pod jiným jménem: stejné číslo, jiná jednotka, ale po
            // přepočtu na základ totéž. 90 kg a 90 mg jsou jen shoda čísel.
            (e) =>
              e.number === later.number &&
              normalize(e.unit) !== normalize(later.unit) &&
              sameDimension(e.dim, later.dim) &&
              e.counts === later.counts &&
              Math.abs(e.base - later.base) <= 1e-9 * Math.abs(e.base),
          );
          if (!before) continue;
          const bridged = texts.some((list) =>
            list.some((latex) => {
              const here = labeledNumbers(latex).map((l) => `${l.number} ${normalize(l.unit)}`);
              return here.includes(`${before.number} ${normalize(before.unit)}`) && here.includes(`${later.number} ${normalize(later.unit)}`);
            }),
          );
          const key = `${template.id}/${ex.solution.steps[index].textKey}`;
          if (!bridged && !findings.has(key)) {
            findings.set(key, `${id}/${ex.solution.steps[index].textKey}: ${before.number} ${before.unit} → ${later.number} ${later.unit}`);
          }
        }
      });
    }
    expect([...findings.values()]).toEqual([]);
  });

  it("mezivýsledek dosazení je jen hodnota, aby šel připojit za „=“", () => {
    const offenders = exercises.flatMap(({ id, ex }) =>
      ex.solution.steps
        .filter((s) => s.substituted && s.result && splitEquals(s.result).length > 1)
        .map((s) => `${id}/${s.textKey}: ${s.result}`),
    );
    expect(offenders.slice(0, 5)).toEqual([]);
  });

  it("v sazbě nezůstal středník po nezdvojeném \\;", () => {
    // `\;` v JavaScriptové šabloně je jen „;“ — z „\min(a,\; b)“ se stane
    // „min(a,; b)“ a přesně tak se to vysází.
    const offenders = exercises.flatMap(({ id, ex }) =>
      ex.solution.steps.flatMap((s) =>
        [s.formula, s.substituted, s.result].filter((l): l is string => !!l && /(?<!\\);/.test(l)).map((l) => `${id}/${s.textKey}: ${l}`),
      ),
    );
    expect(offenders.slice(0, 5)).toEqual([]);
  });
});
