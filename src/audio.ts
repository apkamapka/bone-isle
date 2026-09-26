/**
 * Everything the game plays, and the three knobs on it (Etap 73).
 *
 * Three buses into one context: `beep` (the interface's own blips, as before),
 * `sfx` (the named sounds in sound/synth.ts) and the ambient loop. The first
 * two share the effects volume; the loop has its own. Both volumes and the
 * vibration switch are device settings, kept in localStorage beside nothing
 * else, and changed from the OPTIONS window.
 *
 * A browser will not make a sound before the player has touched the page, so
 * the context is resumed on the first tap or key — and the loop that was
 * asked for while it slept starts then. A hidden tab suspends the lot: a game
 * in the background should not be heard through the pocket.
 */
import { renderAmbient, renderSfx, type AmbientId, type SfxId } from "./sound/synth.ts";
import { isUnderground, type WorldKey } from "./world/types.ts";

export type { AmbientId, SfxId };

type Wave = OscillatorType;

export interface AudioSettings {
  /** Effects volume, 0-1 in tenths. */
  sfx: number;
  /** Ambient loop volume, 0-1 in tenths. */
  ambient: number;
  /** Buzz the phone on a heavy hit, a level-up and a death. */
  vibration: boolean;
}

const SETTINGS_KEY = "bone-isle-audio-v1";
const settings: AudioSettings = { sfx: 0.8, ambient: 0.5, vibration: true };

const tenths = (v: number): number => Math.round(Math.min(1, Math.max(0, v)) * 10) / 10;

(function loadSettings(): void {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(SETTINGS_KEY) : null;
    if (!raw) return;
    const f = JSON.parse(raw) as Partial<AudioSettings>;
    if (typeof f.sfx === "number") settings.sfx = tenths(f.sfx);
    if (typeof f.ambient === "number") settings.ambient = tenths(f.ambient);
    if (typeof f.vibration === "boolean") settings.vibration = f.vibration;
  } catch {
    /* keep the defaults */
  }
})();

function saveSettings(): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* storage unavailable — the setting lasts this session */
  }
}

let ac: AudioContext | null = null;
let sfxBus: GainNode | null = null;
let ambBus: GainNode | null = null;

function ctx(): AudioContext | null {
  if (ac) return ac;
  try {
    const g = globalThis as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
    const AC = g.AudioContext ?? g.webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
    sfxBus = ac.createGain();
    sfxBus.gain.value = settings.sfx;
    sfxBus.connect(ac.destination);
    ambBus = ac.createGain();
    ambBus.gain.value = settings.ambient;
    ambBus.connect(ac.destination);
  } catch {
    ac = null;
  }
  return ac;
}

export function audioSettings(): Readonly<AudioSettings> {
  return settings;
}

export function setSfxVolume(v: number): void {
  settings.sfx = tenths(v);
  if (sfxBus) sfxBus.gain.value = settings.sfx;
  saveSettings();
}

export function setAmbientVolume(v: number): void {
  settings.ambient = tenths(v);
  if (ambBus) ambBus.gain.value = settings.ambient;
  saveSettings();
}

export function setVibration(on: boolean): void {
  settings.vibration = on;
  saveSettings();
}

/** Desktops, and iPhones, have no vibration motor the page may use. */
export function canVibrate(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

export function buzz(pattern: number | number[]): void {
  if (!settings.vibration || !canVibrate()) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* refused — nothing to do */
  }
}

/** The interface's small blips, unchanged except that the volume knob reaches them. */
export function beep(
  freq: number,
  dur: number,
  type: Wave = "square",
  vol = 0.05,
  slide = 0,
): void {
  const a = ctx();
  if (!a || !sfxBus || a.state !== "running") return;
  try {
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type;
    o.frequency.value = freq;
    if (slide) o.frequency.linearRampToValueAtTime(freq + slide, a.currentTime + dur);
    g.gain.value = vol;
    g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
    o.connect(g);
    g.connect(sfxBus);
    o.start();
    o.stop(a.currentTime + dur);
  } catch {
    /* audio not available — ignore */
  }
}

/** How loud each sound sits against the others. */
const SFX_GAIN: Readonly<Record<SfxId, number>> = {
  hit: 0.55, whiff: 0.35, bow: 0.45, knock: 0.45, hurt: 0.6, block: 0.45, death: 0.8, kill: 0.55,
  levelup: 0.6, skillup: 0.45, chop: 0.45, mine: 0.45, heal: 0.5, buff: 0.45, mire: 0.5, fury: 0.55,
  cast: 0.5, rune: 0.6, portal: 0.5, eat: 0.45, coins: 0.45, reward: 0.55, splash: 0.45,
  build: 0.45, forge: 0.5, chime: 0.45, mobheal: 0.35,
};
const SFX_RATE = 44100;
/** Four of one sound at once is a crowd; a fifth adds only noise. */
const MAX_PER_SOUND = 4;
const buffers = new Map<SfxId, AudioBuffer>();
const playing = new Map<SfxId, number>();

export function sfx(id: SfxId, vol = 1): void {
  const a = ctx();
  if (!a || !sfxBus || a.state !== "running") return;
  const busy = playing.get(id) ?? 0;
  if (busy >= MAX_PER_SOUND) return;
  try {
    let b = buffers.get(id);
    if (!b) {
      const data = renderSfx(id, SFX_RATE);
      b = a.createBuffer(1, data.length, SFX_RATE);
      b.getChannelData(0).set(data);
      buffers.set(id, b);
    }
    const src = a.createBufferSource();
    src.buffer = b;
    // a hair of pitch drift so ten sword hits are not one sound ten times
    src.playbackRate.value = 0.95 + Math.random() * 0.1;
    const g = a.createGain();
    g.gain.value = SFX_GAIN[id] * vol;
    src.connect(g);
    g.connect(sfxBus);
    playing.set(id, busy + 1);
    src.onended = () => {
      playing.set(id, Math.max(0, (playing.get(id) ?? 1) - 1));
      g.disconnect();
    };
    src.start();
  } catch {
    /* audio not available — ignore */
  }
}

/* ---- the ambient loop ------------------------------------------------- */

const AMB_RATE = 22050;
const AMB_FADE_S = 1.5;
const ambBuffers = new Map<AmbientId, AudioBuffer>();
let wantAmbient: AmbientId | null = null;
let loop: { id: AmbientId; src: AudioBufferSourceNode; gain: GainNode } | null = null;

/** What a map sounds like: Bonetown, a cave, or the sea. */
export function ambientFor(key: WorldKey): AmbientId {
  if (key === "town") return "town";
  return isUnderground(key) ? "cave" : "sea";
}

/** Ask for a loop. Cheap to call every frame: it only acts on a change. */
export function setAmbient(id: AmbientId | null): void {
  if (id === wantAmbient && (loop?.id ?? null) === id) return;
  wantAmbient = id;
  applyAmbient();
}

function applyAmbient(): void {
  const a = ac;
  if (!a || !ambBus || a.state !== "running") return;
  if ((loop?.id ?? null) === wantAmbient) return;
  const now = a.currentTime;
  if (loop) {
    const old = loop;
    loop = null;
    old.gain.gain.cancelScheduledValues(now);
    old.gain.gain.setValueAtTime(old.gain.gain.value, now);
    old.gain.gain.linearRampToValueAtTime(0, now + AMB_FADE_S);
    try { old.src.stop(now + AMB_FADE_S + 0.05); } catch { /* already stopped */ }
  }
  if (!wantAmbient) return;
  try {
    let b = ambBuffers.get(wantAmbient);
    if (!b) {
      const data = renderAmbient(wantAmbient, AMB_RATE);
      b = a.createBuffer(1, data.length, AMB_RATE);
      b.getChannelData(0).set(data);
      ambBuffers.set(wantAmbient, b);
    }
    const src = a.createBufferSource();
    src.buffer = b;
    src.loop = true;
    const g = a.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(1, now + AMB_FADE_S);
    src.connect(g);
    g.connect(ambBus);
    src.start();
    loop = { id: wantAmbient, src, gain: g };
  } catch {
    loop = null;
  }
}

/** Wake the context on a gesture; the browser allows nothing before one. */
export function unlockAudio(): void {
  const a = ctx();
  if (!a) return;
  if (a.state === "suspended") a.resume().then(applyAmbient).catch(() => undefined);
  else applyAmbient();
}

if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
  document.addEventListener("visibilitychange", () => {
    if (!ac) return;
    if (document.hidden) ac.suspend().catch(() => undefined);
    else ac.resume().then(applyAmbient).catch(() => undefined);
  });
}
if (typeof addEventListener === "function") {
  addEventListener("keydown", unlockAudio);
  addEventListener("pointerdown", unlockAudio);
}
