/**
 * Adresy, na které smí pošťák posílat: jen známé push služby.
 *
 * Databáze jiné odběry nepřijme (migrace 0019, `is_push_endpoint`), tady
 * se to hlídá podruhé, ať funkce nikdy nepošle požadavek jinam, ani
 * kdyby se do tabulky dostalo něco obejitím. Vzor musí být stejný jako
 * v migraci; test to hlídá.
 */
export const PUSH_ENDPOINT =
  /^https:\/\/(fcm\.googleapis\.com|([a-z0-9-]+\.)*push\.apple\.com|([a-z0-9-]+\.)*push\.services\.mozilla\.com|([a-z0-9-]+\.)*notify\.windows\.com)\//;

export function isPushEndpoint(endpoint: string): boolean {
  return PUSH_ENDPOINT.test(endpoint);
}

/** Jak dlouho čekat na jednu push službu, než se odeslání vzdá. */
export const SEND_TIMEOUT_MS = 10_000;

/**
 * Doběhne do limitu, jinak skončí chybou. Zařízení, které neodpoví,
 * tak nepodrží celou dávku a nikdo nedostane zprávu dvakrát.
 */
export function withTimeout<T>(promise: Promise<T>, ms = SEND_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timeout ${ms} ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
