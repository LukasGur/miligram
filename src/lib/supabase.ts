"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Připojení k Supabase.
 *
 * Účet je nepovinný. Aplikace musí běžet i bez nastavených proměnných —
 * bez nich se prostě nedá přihlásit a všechno ostatní funguje dál z místní
 * databáze. Proto se tady nic nevyhazuje a vrací se null.
 *
 * Statický export nemá server, kam by se dala schovat kontrola práv, takže
 * klient sahá do databáze přímo a autorizaci nese Row Level Security.
 * Publikovatelný klíč je proto veřejný záměrně — sám o sobě nic neotevírá.
 */
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

let client: SupabaseClient | null = null;

/**
 * Jak dlouho se čeká na server, než se požadavek vzdá.
 *
 * iOS aplikaci na ploše při odchodu uspí a po návratu někdy nechá viset
 * spojení, které už neexistuje. `fetch` na něm čeká donekonečna: tlačítko
 * zůstalo zašedlé, požadavek nikdy nedorazil na server (edge log mezi
 * probuzením a restartem je prázdný) a pomohl až restart aplikace. S limitem
 * požadavek spadne, obrazovka řekne „zkus to znovu“ a druhý pokus jde
 * novým spojením.
 */
const REQUEST_TIMEOUT_MS = 15_000;

function fetchOnce(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const own = init?.signal;
  // AbortSignal.any je v Safari až od 17.4; bez něj vyhraje vlastní signál
  // volajícího, pokud nějaký má — ten je vzácný a má svůj důvod.
  const signal = !own ? timeout : "any" in AbortSignal ? AbortSignal.any([own, timeout]) : own;
  return fetch(input, { ...init, signal });
}

/**
 * Metody, které jde zopakovat bez následků: druhé smazání téhož souboje
 * nic nesmaže, druhé čtení nic nezmění. POST (nová výzva, RPC) ne — ten by
 * mohl založit dvakrát.
 */
const REPEATABLE = new Set(["GET", "HEAD", "DELETE", "PATCH", "PUT"]);

/**
 * Jeden tichý nový pokus po spadlém spojení.
 *
 * Stažení výzvy hlásilo „chybí připojení“, přitom server ho provedl
 * (edge log: dva DELETE 1,5 s po sobě, oba 204). iPhone po návratu
 * do aplikace posílá po spojení, které mezitím zaniklo; požadavek
 * doletí, odpověď už ne a fetch vyhodí TypeError. Druhý pokus jde novým
 * spojením. Časový limit (AbortError) se neopakuje — to už čekání trvalo
 * dost dlouho.
 */
async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  try {
    return await fetchOnce(input, init);
  } catch (error) {
    if (!(error instanceof TypeError) || !REPEATABLE.has(method) || init?.signal?.aborted) throw error;
    return fetchOnce(input, init);
  }
}

export function supabase(): SupabaseClient | null {
  if (!URL || !KEY) return null;
  client ??= createClient(URL, KEY, {
    global: { fetch: fetchWithTimeout },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // Přihlášení běží kódem opsaným z e-mailu, ne odkazem: odkaz by
      // uživatele vytáhl z aplikace do prohlížeče a v režimu na ploše
      // by se zpátky nevrátil.
      detectSessionInUrl: false,
      flowType: "pkce",
    },
  });
  return client;
}

/** Je serverová vrstva vůbec nastavená? Rozhoduje o tom, co se ukáže v nastavení. */
export function isRemoteConfigured(): boolean {
  return Boolean(URL && KEY);
}
