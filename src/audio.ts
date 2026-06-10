/** Minimal WebAudio blips. Lazily creates the context on first sound. */
let ac: AudioContext | null = null;

type Wave = OscillatorType;

export function beep(
  freq: number,
  dur: number,
  type: Wave = "square",
  vol = 0.05,
  slide = 0,
): void {
  try {
    ac ??= new AudioContext();
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.value = freq;
    if (slide) o.frequency.linearRampToValueAtTime(freq + slide, ac.currentTime + dur);
    g.gain.value = vol;
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
    o.connect(g);
    g.connect(ac.destination);
    o.start();
    o.stop(ac.currentTime + dur);
  } catch {
    /* audio not available / not yet unlocked — ignore */
  }
}

/** Browsers block audio until a user gesture; call this from a click. */
export function unlockAudio(): void {
  if (ac === null) beep(1, 0.01, "sine", 0.001);
}
