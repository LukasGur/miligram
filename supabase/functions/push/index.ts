/**
 * Edge Function `push` — pošťák notifikací.
 *
 * Volá ji pg_cron (public.dispatch_push), jen když je ve frontě co poslat.
 * Komu a kdy rozhoduje databáze; tady se jen převezme dávka, složí texty
 * v jazyce příjemce, zašifruje a odešle na push služby a zapíše výsledek.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import * as webpush from "jsr:@negrel/webpush@0.5.0";
import { compose, type PushKind } from "./compose.ts";

type Subscription = { endpoint: string; p256dh: string; auth: string };

type Claimed = {
  id: number;
  user_id: string;
  kind: PushKind;
  params: Record<string, string | number | null>;
  tag: string;
  locale: string;
  subscriptions: Subscription[] | null;
};

/** Kontakt pro provozovatele push služeb, kdyby s odesíláním byl problém. */
const CONTACT = "mailto:miligram@lukasgurecky.cz";

/**
 * Jak dlouho má push služba zprávu držet, když je telefon offline.
 * Připomínka série po půlnoci nedává smysl, výzva na souboj ano.
 */
const TTL: Partial<Record<PushKind, number>> = {
  streak: 4 * 3600,
  lastChance: 2 * 3600,
  leagueLastDay: 6 * 3600,
  // Připomínka konce lhůty: po šesti hodinách je souboj rozhodnutý.
  duelExpiring: 6 * 3600,
};
const DEFAULT_TTL = 24 * 3600;

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

let server: Promise<{ app: webpush.ApplicationServer; secret: string }> | null = null;

/** Klíče a heslo z Vaultu, jednou za život instance. */
function appServer() {
  server ??= (async () => {
    const { data, error } = await supabase.rpc("push_secrets").single<{ vapid_keys: string; cron_secret: string }>();
    if (error || !data) throw new Error(`Vault: ${error?.message ?? "prázdné"}`);
    const vapidKeys = await webpush.importVapidKeys(JSON.parse(data.vapid_keys));
    const app = await webpush.ApplicationServer.new({ contactInformation: CONTACT, vapidKeys });
    return { app, secret: data.cron_secret };
  })().catch((error) => {
    server = null;
    throw error;
  });
  return server;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response(null, { status: 405 });

  const { app, secret } = await appServer();
  if (request.headers.get("X-Push-Secret") !== secret) return new Response(null, { status: 401 });

  const { data, error } = await supabase.rpc("claim_push_batch", { p_limit: 200 });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  // Den odeslání řídí obměnu textů (compose.ts). Stačí UTC: připomínky
  // chodí mezi šestou ráno a půlnocí místního času, kdy se den shoduje.
  const day = Math.floor(Date.now() / 86_400_000);
  const sent: number[] = [];
  const failed: number[] = [];
  const gone: string[] = [];
  const ok: string[] = [];

  await Promise.all(
    (data as Claimed[]).map(async (row) => {
      const notice = compose(row.kind, row.params, row.tag, row.locale, { user: row.user_id, day });
      const payload = JSON.stringify(notice);
      let delivered = false;

      await Promise.all(
        (row.subscriptions ?? []).map(async (subscription) => {
          try {
            await app
              .subscribe({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } })
              .pushTextMessage(payload, {
                ttl: TTL[row.kind] ?? DEFAULT_TTL,
                urgency: row.kind === "lastChance" ? webpush.Urgency.High : webpush.Urgency.Normal,
                // Téma nahradí na push službě starší nedoručenou zprávu se
                // stejnou značkou. Smí mít jen znaky base64url a nejvýš 32.
                topic: row.tag.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32) || undefined,
              });
            delivered = true;
            ok.push(subscription.endpoint);
          } catch (error) {
            // Knihovna za zmizelé považuje jen 410; FCM u zrušeného odběru
            // vrací i 404.
            if (error instanceof webpush.PushMessageError && [404, 410].includes(error.response.status)) {
              gone.push(subscription.endpoint);
            } else {
              console.error("push", row.kind, subscription.endpoint.slice(0, 40), String(error));
            }
          }
        }),
      );

      // Zpráva platí za doručenou, když ji převzalo aspoň jedno zařízení.
      // Zařízení, která zmizela, se smažou; kdyby zmizela všechna, nemá
      // cenu to zkoušet znovu.
      const everyGone = (row.subscriptions ?? []).every((s) => gone.includes(s.endpoint));
      if (delivered || everyGone) sent.push(row.id);
      else failed.push(row.id);
    }),
  );

  const { error: finishError } = await supabase.rpc("finish_push_batch", {
    p_sent: sent,
    p_failed: failed,
    p_gone: gone,
    p_ok: ok,
  });
  if (finishError) return Response.json({ error: finishError.message }, { status: 500 });

  return Response.json({ sent: sent.length, failed: failed.length, gone: gone.length });
});
