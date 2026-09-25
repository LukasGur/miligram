import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { blockingFor, categoryScores, curriculumState, dailySpec } from "../curriculum";
import { db, recordAnswer } from "../db";

/** Pokus tak, jak ho zapisuje obrazovka lekce. */
const pokus = (templateId: string, index: number, correct: boolean) => ({
  templateId,
  seed: `l:${index}`,
  difficulty: 1,
  index,
  correct,
  hinted: false,
});

/** Nasype odpovědi na jednu šablonu: kolik dohromady a kolik správně. */
async function nauc(templateId: string, answered: number, correct: number) {
  for (let i = 0; i < answered; i += 1) {
    await recordAnswer(`${templateId}-${i}`, pokus(templateId, i, i < correct));
  }
}

beforeEach(async () => {
  const database = db();
  await Promise.all([
    database.profile.clear(),
    database.answers.clear(),
    database.lessons.clear(),
    database.outbox.clear(),
    database.progress.clear(),
  ]);
});

describe("program z uložených odpovědí", () => {
  it("nový uživatel začíná prvním stupněm", async () => {
    const state = await curriculumState();
    expect(state.current).toBe("jednotky");
    expect(dailySpec(state).review).toEqual([]);
  });

  it("zvládnutý stupeň posune program dál a stará látka se začne opakovat", async () => {
    await nauc("H1", 6, 6);
    await nauc("A1", 6, 6);

    const state = await curriculumState();
    expect(state.current).toBe("koncentrace");
    expect([...dailySpec(state).review].sort()).toEqual(["prevody", "zaklad"]);
  });

  it("neopravené chyby jdou do předpisu denní lekce, nejvýš dvě", async () => {
    await recordAnswer("l1", pokus("A1", 0, false));
    await recordAnswer("l1", pokus("A2", 1, false));
    await recordAnswer("l1", pokus("A3", 2, false));

    expect(dailySpec(await curriculumState()).mistakes).toEqual([
      { templateId: "A1", difficulty: 1 },
      { templateId: "A2", difficulty: 1 },
    ]);
  });

  it("počítá první pokus, ne to, co student doklepal", async () => {
    // Dvanáct příkladů, každý napodruhé správně: vyřešeno je všechno,
    // ale napoprvé nic.
    for (let i = 0; i < 12; i += 1) {
      await recordAnswer(`l${i}`, pokus("H1", i, false));
      await recordAnswer(`l${i}`, pokus("H1", i, true));
    }

    const scores = await categoryScores();
    expect(scores.get("prevody")).toEqual({ answered: 12, correct: 0 });
    expect((await curriculumState()).current).toBe("jednotky");
  });

  it("odpověď na šablonu, kterou aplikace nezná, program nepoloží", async () => {
    await nauc("ZZ9", 12, 12);
    await expect(curriculumState()).resolves.toMatchObject({ current: "jednotky" });
  });

  it("předpis vybraného stupně nese jeho opakování a náběh", async () => {
    await nauc("H1", 12, 12);
    const state = await curriculumState();

    const vybrany = dailySpec(state, "inzulin");
    expect(vybrany.stage).toBe("inzulin");
    expect(vybrany.review).toContain("prevody");
    // Inzulin student nezkoušel, takže mírný náběh.
    expect(vybrany.ramp).toBe("intro");
  });

  it("řekne, na čem vybraný stupeň stojí, ale nezakáže ho", async () => {
    const state = await curriculumState();
    expect(blockingFor(state, "perfuzory")?.stage).toBe("koncentrace");
    expect(dailySpec(state, "perfuzory").stage).toBe("perfuzory");
  });
});
