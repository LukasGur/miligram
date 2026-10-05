export type Platform = "ios-safari" | "ios-other-browser" | "android" | "desktop" | "unknown";

export type InstallEligibility = {
  platform: Platform;
  standalone: boolean;
};

/** Aplikace běží z plochy, ne v záložce prohlížeče. */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const navigatorWithLegacy = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    navigatorWithLegacy.standalone === true
  );
}

export function detectPlatform(): Platform {
  if (typeof window === "undefined") return "unknown";
  const ua = window.navigator.userAgent;

  // iPadOS 13+ se hlásí jako Mac; poznáme ho podle dotykových bodů.
  const isIpadOS = window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1;
  const isIos = /iPad|iPhone|iPod/.test(ua) || isIpadOS;

  if (isIos) {
    // Od iOS 16.4 přidají na plochu i Chrome a Edge, jen Sdílet mají
    // nahoře, ne ve spodní liště jako Safari.
    const isOtherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|Brave/.test(ua);
    return isOtherBrowser ? "ios-other-browser" : "ios-safari";
  }
  if (/Android/.test(ua)) return "android";
  return /Mobi/.test(ua) ? "unknown" : "desktop";
}

/**
 * Chrome vystřelí událost dřív, než se stihne připojit React.
 * Odchytáváme ji proto co nejdřív a jen ji odkládáme stranou.
 */
export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<(event: BeforeInstallPromptEvent | null) => void>();

export function captureInstallPrompt() {
  if (typeof window === "undefined") return () => {};

  const onBeforeInstallPrompt = (event: Event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    listeners.forEach((listener) => listener(deferredPrompt));
  };
  const onInstalled = () => {
    deferredPrompt = null;
    listeners.forEach((listener) => listener(null));
  };

  window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  window.addEventListener("appinstalled", onInstalled);
  return () => {
    window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.removeEventListener("appinstalled", onInstalled);
  };
}

export function getInstallPrompt() {
  return deferredPrompt;
}

export function subscribeInstallPrompt(listener: (event: BeforeInstallPromptEvent | null) => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function clearInstallPrompt() {
  deferredPrompt = null;
  listeners.forEach((listener) => listener(null));
}

// Chrome událost vystřelí dřív, než se stihne připojit první komponenta,
// takže odposlech spouštíme hned při načtení modulu.
if (typeof window !== "undefined") captureInstallPrompt();

/**
 * Požádá prohlížeč, aby data aplikace při nedostatku místa nemazal.
 *
 * Bez účtu je celá historie jen v IndexedDB a prohlížeč smí takové
 * úložiště i s cache service workeru uvolnit, když telefonu dochází
 * místo. Aplikace na ploše (Chrome, Safari) dostane souhlas bez dotazu;
 * Firefox se jednou zeptá. Volá se po dohrané lekci, tedy až je co
 * chránit, a nikdy nic neblokuje.
 */
export async function requestPersistentStorage(): Promise<void> {
  try {
    if (typeof navigator === "undefined" || !navigator.storage?.persist) return;
    if (await navigator.storage.persisted()) return;
    await navigator.storage.persist();
  } catch {
    // Nepovinné: bez souhlasu aplikace funguje dál jako dosud.
  }
}
