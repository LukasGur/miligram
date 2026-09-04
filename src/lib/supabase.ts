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

export function supabase(): SupabaseClient | null {
  if (!URL || !KEY) return null;
  client ??= createClient(URL, KEY, {
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
