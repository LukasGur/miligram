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

// ---------------------------------------------------------------------------
// Notifikace
// ---------------------------------------------------------------------------

// Tvar zprávy skládá supabase/functions/push/compose.ts (typ Notice).
// Každý push musí notifikaci opravdu ukázat: iOS po několika tichých
// odběr zruší a Chrome místo ní ukáže vlastní „stránka se aktualizovala“.
self.addEventListener("push", (event) => {
  let notice = {};
  try {
    notice = event.data ? event.data.json() : {};
  } catch {
    // Poškozená zpráva pořád musí něco ukázat — viz výše.
  }

  event.waitUntil(
    self.registration.showNotification(notice.title || "Miligram", {
      body: notice.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      tag: notice.tag,
      // Nová zpráva se stejnou značkou (další výzva od téhož kamaráda)
      // stávající nahradí, ale ozve se znovu.
      renotify: Boolean(notice.tag),
      timestamp: Date.now(),
      data: { url: notice.url || "/", kind: notice.kind },
      actions: Array.isArray(notice.actions) ? notice.actions : [],
    }),
  );
});

// Klepnutí otevře aplikaci tam, kam zpráva míří. Běžící okno se jen
// vytáhne dopředu a cíl dostane zprávou — přenačtení by zahodilo
// rozehranou lekci.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.action === "lesson" ? "/?lesson=daily" : event.notification.data?.url || "/";
  const url = new URL(target, self.location.origin).href;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const open = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (open) {
        await open.focus();
        open.postMessage({ type: "miligram:navigate", url });
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});

// Push služba odběr občas vymění. Nový se tady jen založí se stejným
// klíčem; na server ho zapíše aplikace při příštím spuštění (src/lib/push.ts),
// protože service worker přihlášení nevidí.
self.addEventListener("pushsubscriptionchange", (event) => {
  const key = event.oldSubscription?.options?.applicationServerKey;
  if (!key) return;
  event.waitUntil(
    self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }).catch(() => {}),
  );
});
