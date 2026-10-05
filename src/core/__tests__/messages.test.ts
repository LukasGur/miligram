import { describe, expect, it } from "vitest";
import { createTranslator } from "next-intl";
import cs from "../../../messages/cs.json";
import sk from "../../../messages/sk.json";
import "../templates";
import { allTemplates, buildExercise } from "../templates";
import { ANSWER_UNITS, DIFFICULTIES } from "../types";

/**
 * Texty šablon nesmějí být v komponentách natvrdo, takže jediné místo,
 * kde se dá chyba udělat, je nesoulad mezi klíčem v kódu a klíčem
 * v překladech. Tenhle soubor ten nesoulad hlídá — a nekontroluje jen
 * existenci klíčů, ale zkouší zadání opravdu vysázet s hodnotami,
 * které generátor vrací.
 */
const LOCALES = [["cs", cs], ["sk", sk]] as const;
const SEEDS = Array.from({ length: 8 }, (_, i) => `m${i}`);

describe("překlady zadání a kroků", () => {
  it("obě jazykové sady mají stejné klíče", () => {
    for (const section of ["units", "steps", "rounding", "prompts", "why"] as const) {
      expect(Object.keys(sk.exercise[section]).sort(), section)
        .toEqual(Object.keys(cs.exercise[section]).sort());
    }
  });

  it("každá šablona má zadání v obou jazycích", () => {
    for (const [locale, messages] of LOCALES) {
      const prompts = messages.exercise.prompts as Record<string, string>;
      for (const template of allTemplates()) {
        expect(prompts[template.id], `${locale}/${template.id}`).toBeTruthy();
      }
    }
  });

  it("každá šablona má větu „proč“ bez pomlčky mezi větami", () => {
    for (const [locale, messages] of LOCALES) {
      const why = messages.exercise.why as Record<string, string>;
      for (const template of allTemplates()) {
        expect(why[template.id], `${locale}/${template.id}`).toBeTruthy();
        expect(why[template.id], `${locale}/${template.id}`).not.toMatch(/ [—–] /);
      }
    }
  });

  it("každý krok řešení a poznámka o zaokrouhlení mají překlad", () => {
    for (const [locale, messages] of LOCALES) {
      const steps = messages.exercise.steps as Record<string, string>;
      const rounding = messages.exercise.rounding as Record<string, string>;
      for (const template of allTemplates()) {
        for (const difficulty of DIFFICULTIES) {
          for (const seed of SEEDS) {
            const { solution } = buildExercise(template.id, seed, difficulty);
            for (const step of solution.steps) {
              expect(steps[step.textKey], `${locale}/${template.id}/${step.textKey}`).toBeTruthy();
            }
            if (solution.roundingNoteKey) {
              expect(rounding[solution.roundingNoteKey], `${locale}/${solution.roundingNoteKey}`).toBeTruthy();
            }
          }
        }
      }
    }
  });

  it("každá jednotka odpovědi má popisek", () => {
    for (const [locale, messages] of LOCALES) {
      const units = messages.exercise.units as Record<string, string>;
      for (const unit of ANSWER_UNITS) {
        expect(units[unit], `${locale}/${unit}`).toBeTruthy();
      }
    }
  });

  it("zadání jde vysázet s hodnotami, které generátor vrací", () => {
    const failures: string[] = [];
    for (const [locale, messages] of LOCALES) {
      for (const template of allTemplates()) {
        for (const difficulty of DIFFICULTIES) {
          for (const seed of SEEDS) {
            const { vars } = buildExercise(template.id, seed, difficulty);
            try {
              /**
               * next-intl ve výchozím nastavení chybu jen zaloguje a vrátí
               * klíč, takže by rozbité zadání testem prošlo. Proto se tady
               * chyba vyhazuje — test má spadnout, ne vypsat varování.
               */
              const t = createTranslator({
                locale,
                messages,
                namespace: "exercise.prompts",
                onError: (error) => { throw error; },
              }) as unknown as (key: string, values: Record<string, unknown>) => string;
              const text = t(template.id, vars);
              // Nevyplněný zástupný symbol projde formátováním, ale v textu
              // po sobě nechá složenou závorku — to je taky chyba.
              if (text.includes("{") || text.includes("}")) {
                failures.push(`${locale}/${template.id}/${difficulty}/${seed}: zbyl zástupný symbol`);
              }
            } catch (error) {
              failures.push(`${locale}/${template.id}/${difficulty}/${seed}: ${(error as Error).message}`);
            }
          }
        }
      }
    }
    expect(failures).toEqual([]);
  });

  /**
   * Které hodnoty zadání skutečně zobrazuje. Regulárním výrazem to
   * spolehlivě nejde — název volby v konstrukci plural vypadá stejně jako
   * zástupný symbol. Zjišťuje se to proto pokusem: když se hodnota odebere
   * a sazba spadne, zadání ji potřebuje.
   */
  function shownValues(message: string, locale: string, vars: Record<string, unknown>) {
    const format = (values: Record<string, unknown>) => {
      const t = createTranslator({
        locale,
        messages: { text: message },
        onError: (error) => { throw error; },
      }) as unknown as (key: string, values: Record<string, unknown>) => string;
      return t("text", values);
    };
    return Object.keys(vars).filter((name) => {
      const without = { ...vars };
      delete without[name];
      try {
        format(without);
        return false;
      } catch {
        return true;
      }
    });
  }

  it("zadání zobrazuje přesnou hodnotu, ne zaokrouhlenou", () => {
    /**
     * Formát čísla v zadání je omezený na šest desetinných míst. Kdyby
     * generátor vylosoval jemnější hodnotu, zadání by ukázalo jiné číslo,
     * než se kterým se počítá — přesně to se stalo s dávkou 62,5 mg
     * zobrazenou v gramech jako 0,063 g.
     */
    const failures: string[] = [];
    for (const [locale, messages] of LOCALES) {
      const prompts = messages.exercise.prompts as Record<string, string>;
      for (const template of allTemplates()) {
        for (const difficulty of DIFFICULTIES) {
          for (const seed of SEEDS) {
            const { vars } = buildExercise(template.id, seed, difficulty);
            for (const name of shownValues(prompts[template.id], locale, vars)) {
              const value = vars[name];
              if (typeof value !== "number") continue;
              if (Number(value.toFixed(6)) !== value) {
                failures.push(`${locale}/${template.id}/${difficulty}/${seed}: ${name} = ${value}`);
              }
            }
          }
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it("zadání končí otázkou", () => {
    for (const [locale, messages] of LOCALES) {
      const prompts = messages.exercise.prompts as Record<string, string>;
      for (const template of allTemplates()) {
        expect(prompts[template.id].trimEnd(), `${locale}/${template.id}`).toMatch(/[?}]$/);
      }
    }
  });
  /**
   * Počítané slovo za číslem se musí skloňovat: „2 ampule“, ne „2 ampuli“.
   * Číslo s pevným tvarem slova (`{n, number} ampuli`) sedí jen na jedničku,
   * a tak se tu hledá a místo něj se chce `plural`.
   */
  it("ampule a lahvičky za číslem se skloňují", () => {
    const failures: string[] = [];
    for (const [locale, messages] of LOCALES) {
      for (const [id, text] of Object.entries(messages.exercise.prompts as Record<string, string>)) {
        if (/number[^}]*\}\s+(ampul|lahvič|liekovk|fľaštič)/i.test(text)) failures.push(`${locale}/${id}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it("D3: zadání netvrdí, že ampule z krabičky je naředěná 1:10 000", () => {
    for (const [locale, messages] of LOCALES) {
      const t = createTranslator({
        locale,
        messages,
        namespace: "exercise.prompts",
        onError: (error) => { throw error; },
      }) as unknown as (key: string, values: Record<string, unknown>) => string;
      for (const difficulty of DIFFICULTIES) {
        for (const seed of SEEDS) {
          const { vars } = buildExercise("D3", seed, difficulty);
          const text = t("D3", vars);
          if (vars.ratio === 10000) expect(text, `${locale}/${seed}`).toMatch(/naředili|nariedili/);
          else expect(text, `${locale}/${seed}`).not.toMatch(/naředili|nariedili/);
        }
      }
    }
  });
});
