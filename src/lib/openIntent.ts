"use client";

/**
 * Kam má aplikace skočit po klepnutí na notifikaci.
 *
 * Cíl přijde dvěma cestami: zavřená aplikace se otevře s adresou
 * (`/?lesson=daily`, `/?open=account`), běžící dostane zprávu od service
 * workeru — přenačtení by zahodilo rozehranou lekci. Obojí končí tady.
 *
 * Cíl čeká, dokud si ho někdo nevyzvedne: domovská obrazovka ho umí
 * splnit až po načtení programu, a do té doby odpovídá „ještě ne“.
 */
export type OpenIntent = "lesson" | "account";

/** Vrací true, když cíl splnil; jinak cíl počká na další pokus. */
type Handler = (intent: OpenIntent) => boolean;

let pending: OpenIntent | null = null;
const handlers = new Set<Handler>();
let started = false;

export function parseOpenIntent(href: string): OpenIntent | null {
  const url = new URL(href, "https://miligram.invalid");
  if (url.searchParams.get("lesson") === "daily") return "lesson";
  if (url.searchParams.get("open") === "account") return "account";
  return null;
}

function offer() {
  if (!pending) return;
  for (const handler of handlers) {
    if (handler(pending)) {
      pending = null;
      return;
    }
  }
}

function start() {
  pending = parseOpenIntent(window.location.href);
  if (window.location.search) {
    // Adresa se uklidí, ať přenačtení nebo sdílení cíl nezopakuje.
    window.history.replaceState(null, "", window.location.pathname);
  }

  navigator.serviceWorker?.addEventListener("message", (event: MessageEvent) => {
    const data = event.data as { type?: string; url?: string } | null;
    if (data?.type !== "miligram:navigate" || !data.url) return;
    pending = parseOpenIntent(data.url);
    offer();
  });
}

/**
 * Přihlásí se k cílům. Čekající cíl se nabídne hned po přihlášení
 * (v další mikroúloze, ne uprostřed efektu), další, jak přijdou.
 */
export function onOpenIntent(handler: Handler): () => void {
  if (!started) {
    started = true;
    start();
  }
  handlers.add(handler);
  queueMicrotask(offer);
  return () => {
    handlers.delete(handler);
  };
}
