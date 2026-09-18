import { db, type OutboxEvent } from "./db";

/**
 * Odeslání fronty událostí.
 *
 * Fronta je jednosměrná: zařízení hlásí, co se stalo, server si z toho
 * spočítá skóre sám. Díky tomu nemůže synchronizace nic přepsat a nezáleží
 * na pořadí, v jakém se zařízení ozvou.
 *
 * Odesílání je oddělené od Supabase rozhraním níže, aby se dalo otestovat
 * bez sítě — a aby se dalo vyměnit, kdyby server jednou nebyl Supabase.
 */
export type LessonEventRow = {
  client_event_id: string;
  lesson_id: string;
  answers: unknown;
  finished_at: string;
};

export type SyncGateway = {
  /**
   * Zapíše dávku událostí. Opakované odeslání téže události nesmí skončit
   * chybou — server má na dvojici (uživatel, client_event_id) jedinečnost
   * a duplicitu zahazuje.
   */
  pushLessonEvents(rows: readonly LessonEventRow[]): Promise<void>;
};

export type SyncResult = { sent: number; pending: number };

/** Kolik událostí jde v jedné dávce. Menší dávka přežije horší připojení. */
const BATCH = 25;

export async function syncOutbox(gateway: SyncGateway): Promise<SyncResult> {
  const database = db();
  const waiting = await database.outbox
    .filter((event) => event.syncedAt === undefined)
    .sortBy("id");

  const lessons = waiting.filter((event) => event.type === "lessonFinished");
  let sent = 0;

  for (let start = 0; start < lessons.length; start += BATCH) {
    const batch = lessons.slice(start, start + BATCH);
    await gateway.pushLessonEvents(batch.map(toRow));

    // Označit se smí až po potvrzeném zápisu. Kdyby se to obrátilo,
    // výpadek uprostřed by událost tiše zahodil.
    const now = new Date().toISOString();
    await database.outbox.bulkUpdate(
      batch.map((event) => ({ key: event.id as number, changes: { syncedAt: now } })),
    );
    sent += batch.length;
  }

  const pending = await database.outbox.filter((event) => event.syncedAt === undefined).count();
  return { sent, pending };
}

/**
 * Útrata prášků se zatím neodesílá. Prášky jsou měna a jejich zůstatek
 * dává smysl jen na zařízení; server je bude potřebovat, až se bude
 * kupovat něco, co má platit napříč zařízeními.
 */
function toRow(event: OutboxEvent): LessonEventRow {
  const payload = event.payload as { lessonId?: string; answers?: unknown };
  return {
    // Identita je uid, ne pořadové číslo. Server zahazuje duplicity podle
    // (uživatel, client_event_id) a pořadová čísla se po přeinstalaci i na
    // druhém zařízení opakují — lekce by tiše zmizela.
    client_event_id: event.uid,
    lesson_id: String(payload.lessonId ?? ""),
    answers: payload.answers ?? [],
    finished_at: event.createdAt,
  };
}
