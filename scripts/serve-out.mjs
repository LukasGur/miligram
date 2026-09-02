// Statický server nad out/ pro ověření produkčního chování na telefonu.
// Přes HTTPS, protože service worker mimo localhost jinak nenaběhne.
//
//   pnpm build && pnpm preview
//
// Certifikát bere z ./certificates (vytvoří ho `next dev --experimental-https`).

import { createServer as createHttpsServer } from "node:https";
import { createServer as createHttpServer } from "node:http";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { networkInterfaces } from "node:os";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "out");
const CERT_DIR = path.join(ROOT, "certificates");
const PORT = Number(process.env.PORT ?? 3001);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

function resolveFile(urlPath) {
  const clean = decodeURIComponent(urlPath.split("?")[0]);
  // Zabraňuje úniku mimo out/ přes ../
  const candidate = path.join(OUT, path.normalize(clean).replace(/^(\.\.[/\\])+/, ""));
  if (!candidate.startsWith(OUT)) return null;
  if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  const asIndex = path.join(candidate, "index.html");
  if (existsSync(asIndex)) return asIndex;
  return null;
}

const handler = (req, res) => {
  const file = resolveFile(req.url ?? "/") ?? path.join(OUT, "404.html");
  if (!existsSync(file)) {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("404");
    return;
  }
  const ext = path.extname(file);
  res.writeHead(file.endsWith("404.html") ? 404 : 200, {
    "content-type": MIME[ext] ?? "application/octet-stream",
    // Service worker se nesmí zakešovat v prohlížeči, jinak update nikdy nepřijde.
    "cache-control": file.endsWith("sw.js") ? "no-cache" : "public, max-age=0, must-revalidate",
    "service-worker-allowed": "/",
  });
  createReadStream(file).pipe(res);
};

const key = path.join(CERT_DIR, "localhost-key.pem");
const cert = path.join(CERT_DIR, "localhost.pem");
const secure = existsSync(key) && existsSync(cert);

const server = secure
  ? createHttpsServer({ key: readFileSync(key), cert: readFileSync(cert) }, handler)
  : createHttpServer(handler);

server.listen(PORT, "0.0.0.0", () => {
  const scheme = secure ? "https" : "http";
  const addresses = Object.values(networkInterfaces())
    .flat()
    .filter((i) => i && i.family === "IPv4" && !i.internal)
    .map((i) => `${scheme}://${i.address}:${PORT}`);

  console.log(`${scheme}://localhost:${PORT}`);
  addresses.forEach((a) => console.log(a));
  if (!secure) {
    console.log(
      "\nBez certifikátu běží jen HTTP — service worker naběhne pouze na localhostu.\n" +
        "Certifikát vyrobí `pnpm dev` (next dev --experimental-https) do ./certificates.",
    );
  }
});
