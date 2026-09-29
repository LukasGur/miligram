import type { LessonKind } from "@/core/scoring";
import { db, type OutboxEvent, type WalletPayload } from "./db";

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
  kind: LessonKind;
  answers: unknown;
  finished_at: string;
};

export type WalletEventRow = {
  client_event_id: string;
  kind: WalletPayload["kind"];
  pills: number;
  freezes: number;
  reason: string;
  day: string | null;
  occurred_at: string;
};

export type SyncGateway = {
  /**
   * Zapíše dávku událostí. Opakované odeslání téže události nesmí skončit
   * chybou — server má na dvojici (uživatel, client_event_id) jedinečnost
   * a duplicitu zahazuje.
   */
  pushLessonEvents(rows: readonly LessonEventRow[]): Promise<void>;
  /** Pohyby v peněžence. Duplicitu zahazuje server stejně jako u lekcí. */
  pushWalletEvents(rows: readonly WalletEventRow[]): Promise<void>;
};

/**
 * Server událost odmítl kvůli pravidlu (mez v peněžence, lhůta obnovení
 * série…), ne kvůli síti. Poslat ji znovu nepomůže: odmítne ji zas.
 */
export class RejectedError extends Error {}

/** `rejected`: události, které server odmítl; ve frontě už nečekají. */
export type SyncResult = { sent: number; pending: number; rejected: number };

/** Kolik událostí jde v jedné dávce. Menší dávka přežije horší připojení. */
const BATCH = 25;

export async function syncOutbox(gateway: SyncGateway): Promise<SyncResult> {
  const database = db();
  const waiting = await database.outbox
    .filter((event) => event.syncedAt === undefined)
    .sortBy("id");

  let sent = 0;
  let rejected = 0;

  /** Označit se smí až po potvrzeném zápisu, jinak by výpadek událost tiše zahodil. */
  const settle = async (events: OutboxEvent[], changes: Partial<OutboxEvent>) => {
    await database.outbox.bulkUpdate(events.map((event) => ({ key: event.id as number, changes })));
  };

  /**
   * Nejdřív peněženka, pak lekce. Server skládá sérii z dní s lekcí a dní
   * pokrytých ochranou; když ochrana dorazí první, lekce po ní sérii
   * rovnou prodlouží, místo aby ji na chvíli shodila na jedničku.
   */
  const wallet = waiting.filter((event) => event.type === "wallet");
  const lessons = waiting.filter((event) => event.type === "lessonFinished");

  for (const [events, push] of [
    [wallet, (batch: OutboxEvent[]) => gateway.pushWalletEvents(batch.map(toWalletRow))],
    [lessons, (batch: OutboxEvent[]) => gateway.pushLessonEvents(batch.map(toRow))],
  ] as const) {
    for (let start = 0; start < events.length; start += BATCH) {
      const batch = events.slice(start, start + BATCH);
      try {
        await push(batch);
        await settle(batch, { syncedAt: new Date().toISOString() });
        sent += batch.length;
      } catch (error) {
        if (!(error instanceof RejectedError)) throw error;
        // Dávka se zapisuje celá, nebo vůbec. Jedna odmítnutá událost by
        // tak navždy zadržela ostatní — a protože lekce jdou až po
        // peněžence, i XP v lize. Proto po jedné: odmítnutá se odloží,
        // zbytek projde.
        for (const event of batch) {
          try {
            await push([event]);
            await settle([event], { syncedAt: new Date().toISOString() });
            sent += 1;
          } catch (single) {
            if (!(single instanceof RejectedError)) throw single;
            const now = new Date().toISOString();
            await settle([event], { syncedAt: now, rejectedAt: now });
            rejected += 1;
          }
        }
      }
    }
  }

  const pending = await database.outbox.filter((event) => event.syncedAt === undefined).count();
  return { sent, pending, rejected };
}

function toWalletRow(event: OutboxEvent): WalletEventRow {
  const payload = event.payload as WalletPayload;
  return {
    client_event_id: event.uid,
    kind: payload.kind,
    pills: payload.pills,
    freezes: payload.freezes,
    reason: payload.reason.slice(0, 80),
    day: payload.day ?? null,
    occurred_at: event.createdAt,
  };
}

function toRow(event: OutboxEvent): LessonEventRow {
  // Události z doby před opakováním chyb druh nemají — byly to lekce.
  const payload = event.payload as { lessonId?: string; kind?: LessonKind; answers?: unknown };
  return {
    // Identita je uid, ne pořadové číslo. Server zahazuje duplicity podle
    // (uživatel, client_event_id) a pořadová čísla se po přeinstalaci i na
    // druhém zařízení opakují — lekce by tiše zmizela.
    client_event_id: event.uid,
    lesson_id: String(payload.lessonId ?? ""),
    kind: payload.kind ?? "lesson",
    answers: payload.answers ?? [],
    finished_at: event.createdAt,
  };
}
