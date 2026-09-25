// Vyrobí z brand/icon.svg všechny rastry pro manifest, iOS a favicon
// a vygeneruje seznam startovacích obrazovek pro <link rel="apple-touch-startup-image">.
//
// Spuštění: pnpm icons

import { mkdir, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const SOURCE = path.join(ROOT, "brand", "icon.svg");
const ICONS_DIR = path.join(ROOT, "public", "icons");
const SPLASH_DIR = path.join(ROOT, "public", "splash");

const PAPER = "#ffffff";

/** Kulaté ikony i favicon vycházejí z jednoho zdroje — výměna značky je jeden soubor. */
const ICON_SIZES = [16, 32, 96, 180, 192, 256, 384, 512, 1024];

/**
 * Portrét pro iPhony a iPady, které jsou dnes v provozu.
 * iOS zobrazí splash jen při přesné shodě rozměrů, proto výčet a ne interpolace.
 * Krajina záměrně chybí: aplikace se ovládá na výšku jednou rukou.
 */
const SPLASH_DEVICES = [
  { name: "iphone-16-pro-max", w: 440, h: 956, dpr: 3 },
  { name: "iphone-16-pro", w: 402, h: 874, dpr: 3 },
  { name: "iphone-15-pro-max", w: 430, h: 932, dpr: 3 },
  { name: "iphone-15-pro", w: 393, h: 852, dpr: 3 },
  { name: "iphone-13-pro-max", w: 428, h: 926, dpr: 3 },
  { name: "iphone-13-pro", w: 390, h: 844, dpr: 3 },
  { name: "iphone-11-pro-max", w: 414, h: 896, dpr: 3 },
  { name: "iphone-11", w: 414, h: 896, dpr: 2 },
  { name: "iphone-x", w: 375, h: 812, dpr: 3 },
  { name: "iphone-8-plus", w: 414, h: 736, dpr: 3 },
  { name: "iphone-se", w: 375, h: 667, dpr: 2 },
  { name: "iphone-se-1", w: 320, h: 568, dpr: 2 },
  { name: "ipad-pro-129", w: 1024, h: 1366, dpr: 2 },
  { name: "ipad-pro-11", w: 834, h: 1194, dpr: 2 },
  { name: "ipad-mini", w: 768, h: 1024, dpr: 2 },
];

const source = readFileSync(SOURCE);

async function renderIcons() {
  await mkdir(ICONS_DIR, { recursive: true });
  for (const size of ICON_SIZES) {
    await sharp(source, { density: 600 })
      .resize(size, size, { fit: "cover" })
      .png({ compressionLevel: 9 })
      .toFile(path.join(ICONS_DIR, `icon-${size}.png`));
  }
  // iOS si ikonu ořízne sám a průhlednost nahradí černou — proto plný podklad.
  await sharp(source, { density: 600 })
    .resize(180, 180, { fit: "cover" })
    .flatten({ background: "#3730D9" })
    .png({ compressionLevel: 9 })
    .toFile(path.join(ICONS_DIR, "apple-touch-icon.png"));

  console.log(`ikony: ${ICON_SIZES.length + 1} souborů`);
}

async function renderSplash() {
  await mkdir(SPLASH_DIR, { recursive: true });
  const entries = [];

  for (const device of SPLASH_DEVICES) {
    const width = device.w * device.dpr;
    const height = device.h * device.dpr;
    // Značka drží konstantní optickou velikost napříč zařízeními.
    const mark = Math.round(Math.min(width, height) * 0.22);
    const markPng = await sharp(source, { density: 600 })
      .resize(mark, mark)
      .composite([
        {
          input: Buffer.from(
            `<svg width="${mark}" height="${mark}"><rect width="${mark}" height="${mark}" rx="${Math.round(
              mark * 0.235,
            )}" fill="#fff"/></svg>`,
          ),
          blend: "dest-in",
        },
      ])
      .png()
      .toBuffer();

    const file = `splash-${device.name}.png`;
    await sharp({
      create: { width, height, channels: 4, background: PAPER },
    })
      .composite([{ input: markPng, gravity: "center" }])
      .png({ compressionLevel: 9 })
      .toFile(path.join(SPLASH_DIR, file));

    entries.push({
      href: `/splash/${file}`,
      media: `(device-width: ${device.w}px) and (device-height: ${device.h}px) and (-webkit-device-pixel-ratio: ${device.dpr}) and (orientation: portrait)`,
    });
  }

  const ts = `// Generováno skriptem scripts/make-icons.mjs — needituj ručně.
export type SplashLink = { href: string; media: string };

export const appleSplashLinks: SplashLink[] = ${JSON.stringify(entries, null, 2)};
`;
  await writeFile(path.join(ROOT, "src", "lib", "splashScreens.ts"), ts, "utf8");
  console.log(`splash: ${entries.length} souborů`);
}

/**
 * Ikona do stavového řádku Androidu (`badge` u notifikace). Android z ní
 * bere jen průhlednost a obarví si ji sám — plná ikona aplikace by tam
 * vyšla jako bílý kruh. Tableta se zářezem, zářez je díra.
 */
async function renderBadge() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
    <defs><mask id="cut"><rect width="24" height="24" fill="white"/>
      <rect x="10.9" y="2" width="2.2" height="20" fill="black" transform="rotate(24 12 12)"/></mask></defs>
    <circle cx="12" cy="12" r="10" fill="white" mask="url(#cut)"/>
  </svg>`;
  await sharp(Buffer.from(svg), { density: 600 })
    .resize(96, 96)
    .png({ compressionLevel: 9 })
    .toFile(path.join(ICONS_DIR, "badge-96.png"));
}

await renderIcons();
await renderBadge();
await renderSplash();
