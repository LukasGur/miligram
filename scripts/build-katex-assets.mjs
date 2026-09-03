// Připraví KaTeX pro offline provoz: zkopíruje jen woff2 fonty do public/
// a přepíše CSS tak, aby na ně ukazovalo.
//
// Proč ne prostý `import "katex/dist/katex.min.css"`: balíček nese každý font
// ve třech formátech (woff2, woff, ttf) a bundler by do out/ dal všechny tři.
// Precache service workeru bere celý out/, takže by si každý uživatel stáhl
// 1,1 MB písem místo 296 kB. woff2 umí každý prohlížeč, ve kterém tahle
// aplikace běží (Safari 14+, Chrome 36+).
//
// Výstupy jsou generované — needituj je ručně, spusť `pnpm katex`.

import { createRequire } from "node:module";
import { mkdir, readdir, readFile, copyFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(import.meta.dirname, "..");
const KATEX = path.dirname(require.resolve("katex/package.json"));

const FONT_SOURCE = path.join(KATEX, "dist", "fonts");
const FONT_TARGET = path.join(ROOT, "public", "fonts", "katex");
const CSS_TARGET = path.join(ROOT, "src", "app", "katex.css");
const PUBLIC_PREFIX = "/fonts/katex";

await rm(FONT_TARGET, { recursive: true, force: true });
await mkdir(FONT_TARGET, { recursive: true });

const fonts = (await readdir(FONT_SOURCE)).filter((name) => name.endsWith(".woff2"));
for (const name of fonts) {
  await copyFile(path.join(FONT_SOURCE, name), path.join(FONT_TARGET, name));
}

const css = await readFile(path.join(KATEX, "dist", "katex.min.css"), "utf8");

/**
 * V každém @font-face zůstane jediný zdroj. Původní zápis vypadá takto:
 *   src:url(fonts/X.woff2) format("woff2"),url(fonts/X.woff) format("woff"),…
 * Přepíše se na absolutní cestu do public/ a zbytek se zahodí.
 */
const rewritten = css.replace(/src:[^;}]*?url\(fonts\/([\w-]+)\.woff2\)[^;}]*/g,
  (_match, family) => `src:url(${PUBLIC_PREFIX}/${family}.woff2) format("woff2")`);

const remaining = [...rewritten.matchAll(/url\(([^)]*)\)/g)].map(([, url]) => url);
const unexpected = remaining.filter((url) => !url.startsWith(PUBLIC_PREFIX));
if (unexpected.length > 0) {
  throw new Error(`V CSS zůstaly odkazy mimo ${PUBLIC_PREFIX}: ${unexpected.join(", ")}`);
}
if (remaining.length !== fonts.length) {
  throw new Error(`Odkazů na fonty je ${remaining.length}, souborů ${fonts.length} — CSS se nepřepsalo celé.`);
}

const version = JSON.parse(await readFile(path.join(KATEX, "package.json"), "utf8")).version;
await writeFile(
  CSS_TARGET,
  `/* Generováno skriptem scripts/build-katex-assets.mjs z katex ${version}. Needituj ručně. */\n${rewritten}\n`,
  "utf8",
);

console.log(`katex ${version}: ${fonts.length} fontů do public/fonts/katex, CSS do src/app/katex.css`);
