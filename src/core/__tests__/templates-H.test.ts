import { describe, expect, it } from "vitest";
import "../templates";
import { allTemplates, buildExercise, getTemplate } from "../templates";
import { ELECTROLYTE_LIST } from "../products/electrolytes";
import { PERCENT_SOLUTION_LIST } from "../products/solutions";
import { DIFFICULTIES, type Difficulty } from "../types";

const SEEDS = Array.from({ length: 40 }, (_, i) => `h${i}`);
const D = 2 as Difficulty;

describe("tabulky pro převody", () => {
  it("procentní roztoky mají procenta a mg/ml na sebe", () => {
    for (const [id, item] of PERCENT_SOLUTION_LIST) {
      expect(item.mgPerMl, id).toBeCloseTo(item.percent * 10, 6);
      expect(item.spc, id).toMatch(/^SPC\d+\.pdf$/);
      expect(item.quote.length, id).toBeGreaterThan(30);
    }
  });

  it("molární hmotnost je uvedená jen tam, kde plyne z citace", () => {
    for (const [id, item] of ELECTROLYTE_LIST) {
      if (item.molarMassGPerMol === undefined) continue;
      // 74,5 g/l = 1000 mmol/l, 58,5 mg/ml = 1 mol/l — hmotnost na milimol
      // musí sedět na obsah iontu, jinak by tabulka tvrdila dvě různá čísla.
      expect(item.mgPerMl / item.mmolPerMl, id).toBeCloseTo(item.molarMassGPerMol, 3);
    }
  });

  it("hořčík je jediný dvojmocný a mmol se u něj rozchází s mEq", () => {
    const divalent = ELECTROLYTE_LIST.filter(([, i]) => i.valence > 1);
    expect(divalent.length).toBeGreaterThan(0);
    for (const [id, item] of divalent) {
      expect(item.ion, id).toBe("Mg2+");
      expect(item.valence, id).toBe(2);
    }
  });
});

describe("H1 — převod hmotnosti", () => {
  it("na pevném zadání vyjde ručně ověřená hodnota", () => {
    expect(getTemplate("H1").solve({ value: 0.25, from: "g", to: "mg" }, D).value).toBe(250);
    expect(getTemplate("H1").solve({ value: 250, from: "mg", to: "g" }, D).value).toBe(0.25);
    expect(getTemplate("H1").solve({ value: 2, from: "g", to: "µg" }, D).value).toBe(2_000_000);
  });

  it("odpověď jde zapsat nejvýš na tři desetinná místa", () => {
    for (const difficulty of DIFFICULTIES) {
      for (const seed of SEEDS) {
        const { solution, answer } = buildExercise("H1", seed, difficulty);
        expect(Number(solution.value.toFixed(3)), `${difficulty}/${seed}`).toBe(solution.value);
        expect(answer.decimals).toBeLessThanOrEqual(3);
      }
    }
  });
});

describe("H2 — mmol, mg a mEq", () => {
  it("u dvojmocného iontu je mEq dvojnásobek mmol", () => {
    const solution = getTemplate("H2").solve(
      { direction: "mmolToMeq", valence: 2, mmol: 4.1, ion: "Mg2+", molarMass: 0, massMg: 0 },
      3 as Difficulty,
    );
    // SPC: 1 g heptahydrátu = 8,1 mEq = 4,1 mmol
    expect(solution.value).toBeCloseTo(8.2, 6);
  });

  it("74,5 mg chloridu draselného je 1 mmol", () => {
    const solution = getTemplate("H2").solve(
      { direction: "massToMmol", molarMass: 74.5, massMg: 74.5, mmol: 1, valence: 1, ion: "K+" },
      1 as Difficulty,
    );
    expect(solution.value).toBeCloseTo(1, 9);
  });

  it("třetí úroveň losuje jen dvojmocný ion", () => {
    for (const seed of SEEDS) {
      expect(buildExercise("H2", seed, 3).vars.direction).toBe("mmolToMeq");
    }
  });
});

describe("H3 — mezinárodní jednotky na objem", () => {
  it("100 IU při 100 IU/ml je 1 ml", () => {
    expect(getTemplate("H3").solve({ doseIU: 100, perMl: 100 }, D).value).toBe(1);
  });

  it("odebraný objem se vejde do balení", () => {
    for (const difficulty of DIFFICULTIES) {
      for (const seed of SEEDS) {
        const { vars, solution } = buildExercise("H3", seed, difficulty);
        expect(solution.value, `${difficulty}/${seed}`).toBeLessThanOrEqual(Number(vars.packMl) + 1e-9);
      }
    }
  });

  it("ordinace se nerovná síle v jednom mililitru", () => {
    for (const difficulty of DIFFICULTIES) {
      for (const seed of Array.from({ length: 400 }, (_, i) => `h3-${i}`)) {
        const { vars } = buildExercise("H3", seed, difficulty);
        expect(Number(vars.doseIU), `${difficulty}/${seed}`).not.toBe(Number(vars.perMl));
      }
    }
  });
});

describe("H4 — jednotky a miligramy u enoxaparinu", () => {
  it("6 000 IU odpovídá 60 mg", () => {
    const solution = getTemplate("H4").solve(
      { direction: "iuToMg", iuPerMg: 100, labelMg: 60, labelIU: 6000, givenIU: 6000, givenMg: 60 },
      D,
    );
    expect(solution.value).toBeCloseTo(60, 9);
  });

  it("přepočet se bere z dvojího značení balení, ne z konstanty", () => {
    for (const seed of SEEDS) {
      const { vars } = buildExercise("H4", seed, D);
      expect(Number(vars.iuPerMg)).toBeCloseTo(Number(vars.labelIU) / Number(vars.labelMg), 9);
    }
  });
});

describe("H5 — procenta, mg/ml a g/l", () => {
  it("glukóza 40 % je 400 mg/ml", () => {
    expect(getTemplate("H5").solve({ direction: "percentToMgPerMl", percent: 40, mgPerMl: 400 }, D).value).toBe(400);
  });

  it("g/l je číselně totéž co mg/ml", () => {
    expect(getTemplate("H5").solve({ direction: "percentToGPerL", percent: 0.9, mgPerMl: 9 }, D).value).toBe(9);
  });
});

describe("H6 — mg/ml na mmol/l", () => {
  it("neředěný chlorid draselný 7,45 % je 1000 mmol/l", () => {
    const solution = getTemplate("H6").solve({ code: "0069737", ion: "K+", mgPerMl: 74.5, molarMass: 74.5, dilution: 1 }, D);
    expect(solution.value).toBeCloseTo(1000, 6);
  });

  it("postup ukáže mol/l, převod na mmol/l i rozpad soli na ionty", () => {
    // Příklad z hlášení: 0,05 je správně v mol/l, ale ptáme se na mmol/l.
    // Postup dřív skočil ze zlomku g/l ÷ g/mol rovnou na 50 mmol/l.
    const { value, steps } = getTemplate("H6").solve(
      { code: "0055913", ion: "Na+", mgPerMl: 2.925, molarMass: 58.5, dilution: 20 },
      D,
    );
    expect(value).toBeCloseTo(50, 6);
    expect(steps.map((s) => s.textKey)).toEqual([
      "zadani", "gramyNaLitr", "vzorec", "dosazeni", "naMilimoly", "disociace", "vysledek",
    ]);
    expect(steps[3].result).toBe("0{,}05\\,\\mathrm{mol/l}");
    expect(steps[4].substituted).toBe("0{,}05\\,\\mathrm{mol/l} \\times 1000\\,\\mathrm{mmol/mol}");
    expect(steps[4].result).toBe("50\\,\\mathrm{mmol/l}");
    expect(steps[5].formula).toBe("\\mathrm{NaCl} \\to \\mathrm{Na^{+}} + \\mathrm{Cl^{-}}");
  });
});

describe("kategorie H je kompletní", () => {
  it("registrováno je všech šest šablon", () => {
    const ids = allTemplates().map((t) => t.id).filter((id) => id.startsWith("H"));
    expect(ids.sort()).toEqual(["H1", "H2", "H3", "H4", "H5", "H6"]);
  });
});
