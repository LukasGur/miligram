// Miligram — service worker.
// Generuje ho scripts/build-sw.mjs; PRECACHE a VERSION se dosazují při buildu.
// Neupravuj out/sw.js, uprav tuhle šablonu.

const VERSION = "__BUILD_VERSION__";
/** [adresa, otisk obsahu]. */
const PRECACHE = __PRECACHE_URLS__;

const PRECACHE_NAME = `miligram-precache-${VERSION}`;
const RUNTIME_NAME = `miligram-runtime-${VERSION}`;
const OFFLINE_SHELL = "/";
/** Pod touto adresou si každá precache pamatuje otisky svých souborů. */
const REVISIONS_KEY = "/__miligram-revisions";
/**
 * Kam vede klepnutá notifikace. Verze se nemění, takže ji aktivace nové
 * verze nesmaže; čte ji aplikace (src/lib/openIntent.ts).
 */
const INTENT_CACHE = "miligram-intent";
const INTENT_KEY = "/__miligram-intent";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PRECACHE_NAME);
      const previous = await previousPrecache();

      // Soubor se stejným otiskem se převezme z předchozí verze. Dřív si
      // každá nová verze stáhla všech ~90 souborů (3 MB) znovu, i když se
      // změnily dva. Mění se hlavně index.html a pár balíků kódu.
      //
      // Chybějící soubor instalaci shodí. Neúplná verze by se hned
      // aktivovala, smazala tu předchozí a offline by aplikace nenaběhla.
      // Takhle zůstane stará, dokud se nová nestáhne celá — prohlížeč to
      // zkusí znovu při dalším spuštění.
      try {
        await Promise.all(
          PRECACHE.map(async ([url, revision]) => {
            if (previous && previous.revisions[url] === revision) {
              const kept = await previous.cache.match(url);
              if (kept) {
                await cache.put(url, kept);
                return;
              }
            }
            // reload obchází HTTP cache prohlížeče — jinak by se do precache
            // mohl dostat starý index.html z předchozího nasazení.
            const response = await fetch(new Request(url, { cache: "reload" }));
            if (!response.ok) throw new Error(`${url}: ${response.status}`);
            await cache.put(url, response);
          }),
        );
      } catch (error) {
        await caches.delete(PRECACHE_NAME);
        throw error;
      }
      await cache.put(
        REVISIONS_KEY,
        new Response(JSON.stringify(Object.fromEntries(PRECACHE)), { headers: { "content-type": "application/json" } }),
      );
      await self.skipWaiting();
    })(),
  );
});

/** Předchozí precache a otisky jejích souborů; smaže se až při aktivaci. */
async function previousPrecache() {
  const keys = (await caches.keys()).filter((key) => key.startsWith("miligram-precache-") && key !== PRECACHE_NAME);
  for (const key of keys.reverse()) {
    const cache = await caches.open(key);
    const stored = await cache.match(REVISIONS_KEY);
    if (!stored) continue;
    try {
      return { cache, revisions: await stored.json() };
    } catch {
      // Poškozený záznam: tahle cache se nepoužije.
    }
  }
  return null;
}

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(
            (key) => key.startsWith("miligram-") && key !== PRECACHE_NAME && key !== RUNTIME_NAME && key !== INTENT_CACHE,
          )
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

/** Jak dlouho čekat na dokument ze sítě, když v cache není. */
const NAVIGATION_TIMEOUT_MS = 8000;

/** Shell z kterékoli precache, i z předchozí verze. */
async function anyShell() {
  const keys = (await caches.keys()).filter((key) => key.startsWith("miligram-precache-"));
  for (const key of keys.reverse()) {
    const cache = await caches.open(key);
    const shell = await cache.match(OFFLINE_SHELL);
    if (shell) return shell;
  }
  return undefined;
}

async function fetchWithTimeout(request, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(request, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Když se aplikace nedá načíst vůbec. Bez Reactu a bez next-intl — ty
 * jsou právě to, co se nenačetlo —, a tak texty v obou jazycích tady.
 * Barvy a písmo podle tokenů v src/app/globals.css.
 */
function fallbackPage() {
  const sk = (self.navigator.language || "").toLowerCase().startsWith("sk");
  const text = sk
    ? { title: "Miligram sa nenačítal", body: "Spojenie asi vypadlo. Skús to znova, tvoje dáta sú v telefóne v bezpečí.", retry: "Skúsiť znova" }
    : { title: "Miligram se nenačetl", body: "Spojení nejspíš vypadlo. Zkus to znovu, tvoje data jsou v telefonu v bezpečí.", retry: "Zkusit znovu" };
  const html = `<!doctype html><html lang="${sk ? "sk" : "cs"}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#ffffff"><title>Miligram</title>
<style>
html,body{margin:0;height:100%;background:#fff;color:#0e1116;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
main{box-sizing:border-box;min-height:100%;display:flex;flex-direction:column;max-width:28rem;margin:0 auto;
padding:calc(env(safe-area-inset-top) + 2rem) 1.5rem calc(env(safe-area-inset-bottom) + 1.5rem)}
.mid{flex:1;display:flex;flex-direction:column;justify-content:center}
.mark{width:2.5rem;height:2.5rem;color:#3730d9}
h1{font-size:1.375rem;line-height:1.25;margin:1.5rem 0 .5rem;font-weight:600}
p{color:#5a6472;font-size:1rem;line-height:1.5;margin:0}
button{min-height:3.5rem;width:100%;border:0;border-radius:.75rem;background:#3730d9;color:#fff;font:inherit;font-weight:600;font-size:1rem}
button:active{background:#2b21b8}
</style></head><body><main><div class="mid">
<svg class="mark" viewBox="0 0 24 24" aria-hidden="true"><g transform="rotate(-24 12 12)"><rect x="3" y="7" width="18" height="10" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7v10" stroke="currentColor" stroke-width="2"/></g></svg>
<h1>${text.title}</h1><p>${text.body}</p></div>
<button type="button" onclick="location.reload()">${text.retry}</button>
</main></body></html>`;
  return new Response(html, { status: 503, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

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
  //
  // Po dlouhé nečinnosti umí iOS cache aplikace smazat, zatímco service
  // worker zůstane. Dřív pak navigace čekala na síť bez limitu — a iPhone
  // probuzený po týdnech mívá spojení mrtvé. Výsledek byla černá obrazovka,
  // na kterou nepomohlo nic než zavřít aplikaci. Teď: shell z kterékoli
  // verze precache, jinak síť s limitem, jinak stránka s „Zkusit znovu“.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cached =
          (await caches.match(OFFLINE_SHELL, { cacheName: PRECACHE_NAME })) ?? (await anyShell());
        if (cached) return cached;
        // Precache chybí: ať se při příští příležitosti stáhne znovu.
        self.registration.update().catch(() => {});
        try {
          const response = await fetchWithTimeout(request, NAVIGATION_TIMEOUT_MS);
          if (response.ok) return response;
        } catch {
          // Padá do záložní stránky níže.
        }
        return fallbackPage();
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
//
// Na iPhonu se na zprávu ani na adresu spolehnout nedá: aplikace z plochy
// otevřená přes openWindow začíná na úvodní adrese bez parametrů a uspané
// okno zprávu nemusí dostat. Cíl se proto nejdřív odloží do cache a
// aplikace si ho vyzvedne sama, při startu i po návratu do popředí.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.action === "lesson" ? "/?lesson=daily" : event.notification.data?.url || "/";
  const url = new URL(target, self.location.origin).href;
  // Titulek a text jdou s cílem: běžící lekce z nich ukáže proužek,
  // aby student věděl, co klepnul, a lekci neopouštěl naslepo.
  const note = { title: event.notification.title || "", body: event.notification.body || "" };

  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(INTENT_CACHE);
        await cache.put(
          INTENT_KEY,
          new Response(JSON.stringify({ url, note, at: Date.now() }), { headers: { "content-type": "application/json" } }),
        );
      } catch {
        // Bez cache zbývá zpráva a adresa.
      }

      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const open = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (open) {
        // Zpráva před focus(): ten na iOS umí selhat a zpráva by neodešla.
        open.postMessage({ type: "miligram:navigate", url, note });
        try {
          await open.focus();
          return;
        } catch {
          // Okno nejde vytáhnout dopředu; otevře se znovu níže.
        }
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
