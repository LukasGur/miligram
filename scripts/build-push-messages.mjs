// Texty notifikací pro Edge Function `push`.
//
// Zdrojem jsou `messages/cs.json` a `sk.json` jako u všech ostatních textů.
// Edge Function běží v Deno mimo aplikaci a k souborům messages nedosáhne,
// takže si z nich bere výtah jmenného prostoru `push`. Spouštět po každé
// změně textů; test src/lib/__tests__/pushCompose.test.ts hlídá, že se
// výtah s messages nerozešel.
import { readFileSync, writeFileSync } from "node:fs";

const locales = ["cs", "sk"];
const extract = Object.fromEntries(
  locales.map((locale) => [locale, JSON.parse(readFileSync(`messages/${locale}.json`, "utf8")).push]),
);

writeFileSync(
  "supabase/functions/push/messages.ts",
  `// Generuje scripts/build-push-messages.mjs z messages/*.json. Needitovat ručně.\n\n` +
    `export const MESSAGES = ${JSON.stringify(extract, null, 2)} as const;\n`,
);
