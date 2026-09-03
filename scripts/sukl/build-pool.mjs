/**
 * Sestaví z databáze léčivých přípravků SÚKL fond přípravků pro generátor
 * příkladů a zapíše ho jako typovaný soubor do src/core/products/.
 *
 * Vstup:  scripts/sukl/data/lp.utf8.csv  (vyrobí ./dlp_stahni.sh)
 * Výstup: src/core/products/pool.generated.ts
 *         scripts/sukl/pool-report.json  (podklad k revizi)
 *
 * Pravidla, která skript vynucuje:
 *  - jen položky se stavem registrace R
 *  - jen jednosložkové přípravky; kombinace mají nejednoznačnou sílu
 *  - jen síly, které jdou přečíst bez dohadů
 *  - jedna reprezentace na účinnou látku a sílu, ať fond nezaplní generika
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const HERE = import.meta.dirname;
const ROOT = path.resolve(HERE, "..", "..");
const CSV = path.join(HERE, "data", "lp.utf8.csv");
const DLP_RELEASE = "2026-08-27";

if (!existsSync(CSV)) {
  console.error("Chybí scripts/sukl/data/lp.utf8.csv — spusť nejdřív ./dlp_stahni.sh");
  process.exit(1);
}

/**
 * Výběr účinných látek. Názvy se ověřují proti číselníku ATC ze SÚKL —
 * překlep nebo vymyšlená látka skončí chybou, ne tichým vynecháním.
 */
const VYBER = JSON.parse(readFileSync(path.join(HERE, "latky-vyber.json"), "utf8"));

function substanceNames(group) {
  return Object.entries(VYBER[group])
    .filter(([key]) => !key.startsWith("_"))
    .flatMap(([, names]) => names);
}

const KIND_SELECTION = {
  ampoule: substanceNames("injekce"),
  concentrate: substanceNames("injekce"),
  powderVial: substanceNames("prasky"),
  oralLiquid: substanceNames("peroralniTekute"),
  infusionBag: substanceNames("infuzniVaky"),
};

const TABLET_ATC_GROUPS = VYBER.tabletyAtcSkupiny.skupiny;

/** Látky, u kterých je volba správné síly součástí výpočtu. */
const KEEP_ALL_STRENGTHS = new Set(VYBER.vsechnySily.latky);

/** Skupiny, u kterých by cvičný výpočet působil nepatřičně. */
const ATC_DENY = ["V12", "V08", "V09", "V10", "V07"];

/** Číselník ATC: kód → název účinné látky. Autoritativní zdroj názvů. */
const ATC_NAMES = new Map();
for (const line of readFileSync(path.join(HERE, "data", "atc.utf8.csv"), "utf8").split("\n").slice(1)) {
  const cells = line.split(";");
  if (cells[0]?.trim()) ATC_NAMES.set(cells[0].trim(), (cells[2] ?? "").trim());
}

/** Kódy ATC, pod kterými vybraná látka v číselníku vystupuje. */
const CODES_BY_KIND = {};
const unknownNames = new Set(Object.values(KIND_SELECTION).flat());
for (const [kind, names] of Object.entries(KIND_SELECTION)) {
  const wanted = new Set(names);
  const codes = new Set();
  for (const [code, name] of ATC_NAMES) {
    if (code.length === 7 && wanted.has(name)) {
      codes.add(code);
      unknownNames.delete(name);
    }
  }
  CODES_BY_KIND[kind] = codes;
}
if (unknownNames.size > 0) {
  console.error("Tyto názvy nejsou v číselníku ATC — oprav latky-vyber.json:");
  for (const name of unknownNames) console.error("  " + name);
  process.exit(1);
}

const COL = {
  code: 0, name: 2, strength: 3, form: 4, pack: 5, reg: 13, atc: 18,
};

/** Rozdělí sílu na číslo a jednotku, případně i na objem, ve kterém je uvedená. */
function parseStrength(raw) {
  const text = raw.trim().toUpperCase().replace(/\s+/g, "");
  if (!text) return null;
  // Kombinace účinných látek: 500MG/125MG, 400MG/5ML+57MG/5ML
  if (text.includes("+")) return null;

  /**
   * Dvojí značení: 6000IU(60MG)/0,6ML. Používají ho nízkomolekulární
   * hepariny a somatropin — obě čísla popisují tutéž látku, jen jinou
   * stupnicí. Pro výpočet objemu je rozhodná hmotnost, aktivita se
   * uchová zvlášť, protože zadání ji často uvádí místo miligramů.
   */
  const dual = text.match(/^([\d,.]+)(IU|U)\(([\d,.]+)(MG|G|MCG)\)(?:\/([\d,.]*)ML)?$/);
  if (dual) {
    const [, activity, , amount, massUnit, volume] = dual;
    return {
      amount: num(amount),
      unit: normalizeUnit(massUnit),
      volumeMl: volume === undefined ? null : volume === "" ? 1 : num(volume),
      activityIU: num(activity),
    };
  }

  const perVolume = text.match(/^([\d,.]+)(MG|G|MCG|µG|UG|IU|U)\/([\d,.]*)(ML)$/);
  if (perVolume) {
    const [, amount, unit, volume] = perVolume;
    return {
      amount: num(amount),
      unit: normalizeUnit(unit),
      volumeMl: volume === "" ? 1 : num(volume),
      activityIU: null,
    };
  }

  const plain = text.match(/^([\d,.]+)(MG|G|MCG|µG|UG|IU|U)$/);
  if (plain) {
    return { amount: num(plain[1]), unit: normalizeUnit(plain[2]), volumeMl: null, activityIU: null };
  }
  return null;
}

const num = (text) => Number(text.replace(",", "."));

function normalizeUnit(unit) {
  if (unit === "G") return { unit: "mg", factor: 1000 };
  if (unit === "MCG" || unit === "µG" || unit === "UG") return { unit: "mg", factor: 0.001 };
  if (unit === "IU" || unit === "U") return { unit: "IU", factor: 1 };
  return { unit: "mg", factor: 1 };
}

/** Z balení typu 5X2ML vytáhne počet kusů a objem jednoho kusu. */
function parsePack(raw) {
  const text = raw.trim().toUpperCase().replace(/\s+/g, "");
  const withVolume = text.match(/^(\d+)X([\d,.]+)ML/);
  if (withVolume) return { count: Number(withVolume[1]), unitVolumeMl: num(withVolume[2]) };
  const onlyVolume = text.match(/^([\d,.]+)ML/);
  if (onlyVolume) return { count: 1, unitVolumeMl: num(onlyVolume[1]) };
  const onlyCount = text.match(/^(\d+)/);
  if (onlyCount) return { count: Number(onlyCount[1]), unitVolumeMl: null };
  return { count: null, unitVolumeMl: null };
}

/** Zařadí přípravek podle lékové formy do skupiny, se kterou pracují šablony. */
function classify(form, strength, pack) {
  const f = form.toUpperCase();
  const isPowder = /PLV/.test(f);
  const isParenteral = /INJ|INF/.test(f);

  if (/^(TBL|CPS)/.test(f)) {
    return strength.volumeMl === null ? "tablet" : null;
  }
  if (/^POR/.test(f) && /SUS|SOL/.test(f)) {
    return strength.volumeMl !== null ? "oralLiquid" : null;
  }
  if (isParenteral && isPowder) {
    return strength.volumeMl === null ? "powderVial" : null;
  }
  if (/CNC/.test(f) && isParenteral) {
    return strength.volumeMl !== null ? "concentrate" : null;
  }
  if (isParenteral && strength.volumeMl !== null) {
    // Vak nad 50 ml se nepodává stříkačkou, počítá se u něj rychlost infuze.
    const volume = pack.unitVolumeMl ?? 0;
    return volume >= 50 ? "infusionBag" : "ampoule";
  }
  return null;
}

const rows = readFileSync(CSV, "utf8").split("\n").slice(1);
const candidates = [];

for (const line of rows) {
  if (!line.trim()) continue;
  const cells = line.split(";");
  if (cells[COL.reg] !== "R") continue;

  const atc = (cells[COL.atc] ?? "").trim();
  if (!atc) continue;
  if (ATC_DENY.some((prefix) => atc.startsWith(prefix))) continue;

  const strength = parseStrength(cells[COL.strength] ?? "");
  if (!strength) continue;

  const pack = parsePack(cells[COL.pack] ?? "");
  const kind = classify(cells[COL.form] ?? "", strength, pack);
  if (!kind) continue;

  const passes = kind === "tablet"
    ? TABLET_ATC_GROUPS.some((prefix) => atc.startsWith(prefix))
    : CODES_BY_KIND[kind].has(atc);
  if (!passes) continue;

  const amountBase = strength.amount * strength.unit.factor;
  if (!Number.isFinite(amountBase) || amountBase <= 0) continue;

  candidates.push({
    code: cells[COL.code].trim(),
    name: cells[COL.name].trim(),
    atc,
    substance: ATC_NAMES.get(atc) ?? "",
    kind,
    strength: Number(amountBase.toFixed(6)),
    strengthUnit: strength.unit.unit,
    volumeMl: strength.volumeMl,
    form: cells[COL.form].trim(),
    pack: cells[COL.pack].trim(),
    packCount: pack.count,
    packUnitVolumeMl: pack.unitVolumeMl,
    activityIU: strength.activityIU ?? null,
  });
}

/**
 * Jedna reprezentace na (účinná látka, síla, objem, skupina).
 * Z duplicit vyhrává nejkratší název — bývá to původní značka
 * bez marketingových přívlastků.
 */
const byKey = new Map();
for (const item of candidates) {
  const key = [item.atc, item.kind, item.strength, item.volumeMl ?? "-"].join("|");
  const current = byKey.get(key);
  if (!current || item.name.length < current.name.length) byKey.set(key, item);
}

/** Nejvýš dvě síly na účinnou látku a skupinu, ať fond není jen jeden lék v deseti silách. */
const perSubstance = new Map();
const pool = [];
for (const item of [...byKey.values()].sort((a, b) => a.atc.localeCompare(b.atc) || a.strength - b.strength)) {
  if (KEEP_ALL_STRENGTHS.has(item.substance)) {
    pool.push(item);
    continue;
  }
  const key = `${item.atc}|${item.kind}`;
  const used = perSubstance.get(key) ?? 0;
  if (used >= 2) continue;
  perSubstance.set(key, used + 1);
  pool.push(item);
}

const byKind = {};
for (const item of pool) byKind[item.kind] = (byKind[item.kind] ?? 0) + 1;

writeFileSync(
  path.join(HERE, "pool-report.json"),
  JSON.stringify({ release: DLP_RELEASE, total: pool.length, byKind, pool }, null, 2),
  "utf8",
);

const TS_HEADER = `// Generováno skriptem scripts/sukl/build-pool.mjs — needituj ručně.
//
// Zdroj: SÚKL, Databáze léčivých přípravků, vydání ${DLP_RELEASE}.
// Obsahuje výhradně přípravky se stavem registrace R a s jednoznačně
// čitelnou silou. Výběr účinných látek je v scripts/sukl/latky-vyber.json;
// faktické údaje níže pocházejí z DLP, ne z výběru.

import type { Product } from "./types";

export const DLP_RELEASE = "${DLP_RELEASE}";

export const PRODUCTS: readonly Product[] = [
`;

const lines = pool.map((p) => {
  const fields = [
    `code: ${JSON.stringify(p.code)}`,
    `name: ${JSON.stringify(p.name)}`,
    `substance: ${JSON.stringify(p.substance)}`,
    `atc: ${JSON.stringify(p.atc)}`,
    `kind: ${JSON.stringify(p.kind)}`,
    `strength: ${p.strength}`,
    `strengthUnit: ${JSON.stringify(p.strengthUnit)}`,
    p.volumeMl !== null ? `volumeMl: ${p.volumeMl}` : null,
    `form: ${JSON.stringify(p.form)}`,
    `pack: ${JSON.stringify(p.pack)}`,
    p.packCount !== null ? `packCount: ${p.packCount}` : null,
    p.packUnitVolumeMl !== null ? `packUnitVolumeMl: ${p.packUnitVolumeMl}` : null,
    p.activityIU !== null ? `activityIU: ${p.activityIU}` : null,
  ].filter(Boolean);
  return `  { ${fields.join(", ")} },`;
});

const outDir = path.join(ROOT, "src", "core", "products");
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, "pool.generated.ts"), TS_HEADER + lines.join("\n") + "\n];\n", "utf8");

console.log(`kandidátů: ${candidates.length}`);
console.log(`po deduplikaci: ${byKey.size}`);
console.log(`ve fondu: ${pool.length}`);
console.table(byKind);
