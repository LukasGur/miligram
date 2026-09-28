import { db } from "./db";

/**
 * Jak dobře student zná jednotlivé typy příkladů.
 *
 * - `seen` — šablona, na kterou už někdy odpovídal. Kdo ji ještě neviděl,
 *   dostane před prvním příkladem vyřešený vzor, ne slepý pokus.
 * - `mastered` — šablona, kterou aspoň jednou spočítal bez nápovědy. Dokud
 *   ne, je nápověda k ní zadarmo: učit se z ní nemá stát pastilky.
 *
 * Počítá se z uložených odpovědí, takže to platí i po obnově na novém
 * telefonu a nic dalšího se nemusí ukládat.
 */
export type Familiarity = { seen: ReadonlySet<string>; mastered: ReadonlySet<string> };

export async function templateFamiliarity(): Promise<Familiarity> {
  const seen = new Set<string>();
  const mastered = new Set<string>();
  await db().answers.each((answer) => {
    seen.add(answer.templateId);
    if (answer.correct && !answer.hinted) mastered.add(answer.templateId);
  });
  return { seen, mastered };
}
