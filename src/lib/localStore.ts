/**
 * Tenká vrstva nad localStorage pro pár hodnot, které musí být k dispozici
 * ještě před inicializací databáze (souhlas s podmínkami, jazyk, skryté lišty).
 * Herní stav sem nepatří — ten půjde ve fázi 4 do Dexie.
 *
 * Zápis rozešle událost, aby na něj šlo reagovat přes useSyncExternalStore
 * a komponenty nemusely stav zrcadlit do useState.
 */
const CHANGE_EVENT = "miligram:localchange";

export function readLocal(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeLocal(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Soukromý režim nebo zaplněná kvóta — aplikace musí běžet dál.
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: key }));
}

export function subscribeLocal(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  // storage se volá jen z jiných záložek, ale i to je změna, kterou chceme vidět.
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export const STORAGE_KEYS = {
  disclaimerAcceptedAt: "miligram.disclaimer.acceptedAt",
  installBannerDismissedAt: "miligram.install.dismissedAt",
  locale: "miligram.locale",
  /**
   * Účet, který na tomhle zařízení zapnul notifikace. Prázdné = vypnuto.
   * Po odhlášení a přihlášení téhož účtu se odběr obnoví sám, jinému ne.
   */
  pushOwner: "miligram.push.owner",
  /**
   * Který odběr (účet a endpoint) už server zná. Obnova po spuštění
   * se pak neposílá znovu se stejnými údaji.
   */
  pushRegistered: "miligram.push.registered",
  /** Kdy naposledy uživatel odmítl nabídku notifikací po lekci. */
  pushOfferDismissedAt: "miligram.push.offerDismissedAt",
  /** Kolikrát ji odmítl. Po třetím odmítnutí se nabídka už neukáže. */
  pushOfferDismissals: "miligram.push.offerDismissals",
  /**
   * První vynechaný den série, jejíž obnovení student odmítl. Další ztráta
   * má jiný den, takže se nabídne znovu.
   */
  repairDismissed: "miligram.repair.dismissed",
  /** Bublina „podívej se na vzor“ se ukázala a student ji zavřel. */
  exampleCoachSeen: "miligram.coach.example",
} as const;
