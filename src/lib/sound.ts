import { readLocal, STORAGE_KEYS } from "./localStore";

/**
 * Cinknutí pastilky.
 *
 * Zvuk se skládá v prohlížeči, ne z nahrávky: nic se nestahuje, funguje
 * offline a nepřidá do balíku ani bajt navíc.
 *
 * Na iPhonu se musí řídit přepínačem zvonění. Web Audio s relací
 * „ambient“ (Safari 17+) při vypnutém zvonění mlčí a nepřeruší hudbu,
 * kterou uživatel zrovna poslouchá. Starší Safari relaci neumí, ale Web
 * Audio tam přepínač respektuje i bez ní — dokud na stránce nehraje
 * <audio>, a to tahle aplikace nemá.
 *
 * iOS pustí zvuk jen z kontextu, který se probudil na dotyk. Proto se
 * probouzí v obsluze klepnutí (`primeSound`), a samotný cink pak může
 * zaznít později, třeba na konci animace.
 */

let context: AudioContext | null = null;

export function soundEnabled(): boolean {
  return readLocal(STORAGE_KEYS.sound) !== "off";
}

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (context) return context;
  const Context =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Context) return null;
  const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
  if (session) session.type = "ambient";
  context = new Context();
  return context;
}

/** Probudí zvuk. Volá se z obsluhy klepnutí, jinak ho iOS nepustí. */
export function primeSound(): void {
  if (!soundEnabled()) return;
  const ctx = audio();
  if (ctx && ctx.state !== "running") void ctx.resume().catch(() => {});
}

/**
 * Jeden cink. `step` zvedá tón po stupních pentatoniky, takže řada
 * pastilek padajících do peněženky stoupá a nezní jako jeden zvuk
 * opakovaný dokola. Nad sedmým stupněm už nestoupá — výš by pištěl.
 */
export function chime(step = 0): void {
  if (!soundEnabled()) return;
  const ctx = audio();
  if (!ctx || ctx.state !== "running") return;

  const scale = [0, 2, 4, 7, 9, 12, 14];
  const semitones = scale[Math.min(step, scale.length - 1)];
  const base = 1318.5 * 2 ** (semitones / 12);
  const now = ctx.currentTime;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.09, now + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
  gain.connect(ctx.destination);

  // Základ a o kvintu výš tišeji — kovový, ale ne ostrý tón.
  for (const [ratio, level] of [
    [1, 1],
    [1.5, 0.35],
  ] as const) {
    const osc = ctx.createOscillator();
    const partial = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(base * ratio, now);
    partial.gain.value = level;
    osc.connect(partial).connect(gain);
    osc.start(now);
    osc.stop(now + 0.34);
  }
}
