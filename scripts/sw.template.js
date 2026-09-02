// Miligram — service worker.
// Generuje ho scripts/build-sw.mjs; PRECACHE a VERSION se dosazují při buildu.
// Neupravuj out/sw.js, uprav tuhle šablonu.

const VERSION = "__BUILD_VERSION__";
const PRECACHE = __PRECACHE_URLS__;

const PRECACHE_NAME = `miligram-precache-${VERSION}`;
const RUNTIME_NAME = `miligram-runtime-${VERSION}`;
const OFFLINE_SHELL = "/";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PRECACHE_NAME);
      // reload obchází HTTP cache prohlížeče — jinak by se do precache
      // mohl dostat starý index.html z předchozího nasazení.
      await Promise.all(
        PRECACHE.map(async (url) => {
          try {
            const response = await fetch(new Request(url, { cache: "reload" }));
            if (response.ok) await cache.put(url, response);
          } catch {
            // Jeden nedostupný soubor nesmí shodit celou instalaci.
          }
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("miligram-") && key !== PRECACHE_NAME && key !== RUNTIME_NAME)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigace: aplikace je jednostránkový shell, takže offline i online
  // vracíme přednačtený dokument a data si aplikace řeší sama.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cached = await caches.match(OFFLINE_SHELL, { cacheName: PRECACHE_NAME });
        if (cached) return cached;
        try {
          return await fetch(request);
        } catch {
          return new Response("", { status: 504, statusText: "Offline" });
        }
      })(),
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cached = await caches.match(request, { ignoreSearch: false });
      if (cached) return cached;

      try {
        const response = await fetch(request);
        // Neúplné odpovědi (206) a chyby do cache nepatří.
        if (response.ok && response.status === 200) {
          const runtime = await caches.open(RUNTIME_NAME);
          runtime.put(request, response.clone());
        }
        return response;
      } catch (error) {
        const fallback = await caches.match(request, { ignoreSearch: true });
        if (fallback) return fallback;
        throw error;
      }
    })(),
  );
});
