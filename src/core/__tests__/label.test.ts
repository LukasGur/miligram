import { describe, expect, it } from "vitest";
import { packageLabel } from "../products/label";

describe("název přípravku do zadání", () => {
  it("nechá značku velkými písmeny a sílu, lékovou formu zahodí", () => {
    expect(packageLabel("Ceftriaxon Kabi 1 g prášek pro injekční/infuzní roztok")).toBe("CEFTRIAXON KABI 1 g");
    expect(packageLabel("Nurofen pro děti 20 mg/ml perorální suspenze")).toBe("NUROFEN PRO DĚTI 20 mg/ml");
    expect(packageLabel("Augmentin 400 mg/5 ml + 57 mg/5 ml prášek pro perorální suspenzi")).toBe(
      "AUGMENTIN 400 mg/5 ml + 57 mg/5 ml",
    );
    expect(packageLabel("Ardeaelytosol conc. kaliumchlorid 7,45% koncentrát pro infuzní roztok")).toBe(
      "ARDEAELYTOSOL CONC. KALIUMCHLORID 7,45%",
    );
    expect(packageLabel("Chlorid sodný B. Braun 0,9 % infuzní roztok")).toBe("CHLORID SODNÝ B. BRAUN 0,9 %");
    expect(packageLabel("Magnesium sulfate Kalceks 100 mg/ml injekční/infuzní roztok")).toBe(
      "MAGNESIUM SULFATE KALCEKS 100 mg/ml",
    );
    expect(packageLabel("PARALEN 125 mg tablety")).toBe("PARALEN 125 mg");
    expect(packageLabel("Vancomycin Kabi 1000 mg prášek pro koncentrát pro infuzní roztok")).toBe("VANCOMYCIN KABI 1000 mg");
  });

  it("krátký název z DLP nechá být", () => {
    expect(packageLabel("TENSAMIN")).toBe("TENSAMIN");
  });
});
