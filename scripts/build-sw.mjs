// Po `next build` projde out/, sestaví precache manifest a zapíše out/sw.js.
// Verze cache je otisk obsahu — každý build si tak vynutí novou instalaci.
// Každý soubor má i vlastní otisk (revizi): nová verze si stáhne jen soubory,
// které se změnily, zbytek převezme z předchozí cache (sw.template.js).

import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "out");
const TEMPLATE = path.join(ROOT, "scripts", "sw.template.js");

/**
 * Startovací obrazovky iOS si stáhne až ve chvíli přidání na plochu,
 * takže je do precache netaháme — jen by prodloužily první instalaci.
 */
const EXCLUDED_PREFIXES = ["/splash/"];
// 404.html server vrací se stavem 404, takže by se do precache stejně nedostal;
// navigace má fallback na shell, tuhle stránku offline nepotřebujeme.
const EXCLUDED_FILES = new Set(["/sw.js", "/404.html"]);

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else files.push(full);
  }
  return files;
}

function toUrl(filePath) {
  const rel = "/" + path.relative(OUT, filePath).split(path.sep).join("/");
  if (rel.endsWith("/index.html")) return rel.slice(0, -"index.html".length);
  return rel;
}

const files = await walk(OUT);
const hash = createHash("sha256");
const urls = [];

for (const file of files.sort()) {
  const url = toUrl(file);
  if (EXCLUDED_FILES.has(url)) continue;
  if (EXCLUDED_PREFIXES.some((prefix) => url.startsWith(prefix))) continue;

  const content = await readFile(file);
  const digest = createHash("sha256").update(content).digest();
  hash.update(url).update(digest);
  urls.push([url, digest.toString("hex").slice(0, 16)]);
}

const version = hash.digest("hex").slice(0, 16);
const template = await readFile(TEMPLATE, "utf8");
const sw = template
  .replace("__BUILD_VERSION__", version)
  .replace("__PRECACHE_URLS__", JSON.stringify(urls, null, 2));

await writeFile(path.join(OUT, "sw.js"), sw, "utf8");

const bytes = (await Promise.all(files.map(async (f) => (await stat(f)).size))).reduce((a, b) => a + b, 0);
console.log(
  `sw.js: ${urls.length} souborů v precache, verze ${version}, out/ celkem ${(bytes / 1024 / 1024).toFixed(2)} MB`,
);
