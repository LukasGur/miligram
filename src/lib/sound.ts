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

/** Tón o `semitones` půltónů nad komorním a¹ (440 Hz). */
const tone = (semitones: number) => 440 * 2 ** (semitones / 12);

/**
 * Jedna nota: trojúhelníková vlna, rychlý náběh a doznění, obroušená
 * dolní propustí. Trojúhelník zní jako mince, sinus by byl plochý
 * a obdélník by pištěl.
 */
function note(ctx: AudioContext, semitones: number, at: number, length: number, peak: number, overtone = false) {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 5200;
  gain.connect(filter).connect(ctx.destination);

  const voices: [OscillatorType, number, number][] = [["triangle", semitones, 1]];
  // Tichá sinusová oktáva nad tónem mu dodá třpyt.
  if (overtone) voices.push(["sine", semitones + 12, 0.25]);
  for (const [type, pitch, level] of voices) {
    const osc = ctx.createOscillator();
    const voice = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(tone(pitch), at);
    voice.gain.value = level;
    osc.connect(voice).connect(gain);
    osc.start(at);
    osc.stop(at + length + 0.05);
  }
}

function running(): AudioContext | null {
  if (!soundEnabled()) return null;
  const ctx = audio();
  return ctx && ctx.state === "running" ? ctx : null;
}

/**
 * Mince: dva rychlé tóny o kvartu nahoru (h² → e³). Takhle zní sebraná
 * mince ve hrách a každý ji pozná jako „něco přibylo“.
 *
 * `step` celou dvojici posouvá výš, takže řada pastilek padajících
 * do zůstatku stoupá. Nad šestým stupněm už nestoupá — výš by pištěla.
 */
export function chime(step = 0): void {
  const ctx = running();
  if (!ctx) return;
  const base = [14, 16, 19, 21, 23, 26][Math.min(step, 5)];
  const now = ctx.currentTime + 0.01;
  note(ctx, base, now, 0.42, 0.11);
  note(ctx, base + 5, now + 0.07, 0.5, 0.12, true);
}

/** Tečka za odměnou: krátký rozložený akord po posledním dopadu. */
export function flourish(): void {
  const ctx = running();
  if (!ctx) return;
  const now = ctx.currentTime + 0.01;
  [26, 30, 33, 38].forEach((pitch, index) => note(ctx, pitch, now + index * 0.05, 0.9, 0.08));
}
