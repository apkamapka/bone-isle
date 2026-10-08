/**
 * Every sound in the game, made from arithmetic (Etap 73).
 *
 * There are no audio files. Each effect is a short recipe — a tone that
 * slides, a burst of filtered noise, a plucked string, a struck bell — turned
 * into samples the first time it is played. Nothing to download, no licence
 * to follow, and a phone on a thin connection never pays megabytes for a
 * sword hit.
 *
 * Pure functions and plain Float32Arrays: nothing here touches Web Audio, so
 * the smoke suite renders every sound headless and checks that it is finite,
 * audible, and ends in silence rather than a click. `audio.ts` plays them.
 *
 * The ambient loops are longer recipes built from the same parts. Each is
 * rendered a second longer than it plays and the spare second is folded back
 * over its head with an equal-power crossfade, so the join is just another
 * moment in the loop.
 */

/* The NAMES of the sounds are in systems/fxEvents.ts since Etap 3.1a — the
 * logic asks for a sound by name and must not have to load this file to do
 * it. The record below still has to cover every one of them, and the type
 * checker holds it to that. */
import type { SfxId } from "../systems/fxEvents.ts";
export type { SfxId };

export type AmbientId = "sea" | "cave" | "town";

/** Seconds per sound. */
const LEN: Readonly<Record<SfxId, number>> = {
  hit: 0.18, whiff: 0.16, bow: 0.32, knock: 0.14, hurt: 0.24, block: 0.2, death: 1.3, kill: 0.4,
  levelup: 1.0, skillup: 0.5, chop: 0.2, mine: 0.22, heal: 0.7, buff: 0.5, mire: 0.6, fury: 0.65,
  cast: 0.5, rune: 0.8, portal: 1.0, eat: 0.3, coins: 0.55, reward: 0.9, splash: 0.55,
  build: 0.55, forge: 0.7, chime: 0.8, mobheal: 0.5,
};

export const SFX_IDS = Object.keys(LEN) as SfxId[];
export const AMBIENT_IDS: readonly AmbientId[] = ["sea", "cave", "town"];
export const AMBIENT_LOOP_S: Readonly<Record<AmbientId, number>> = { sea: 12, cave: 14, town: 16 };

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Osc = "sine" | "tri" | "sq" | "saw";

function wave(type: Osc, ph: number): number {
  const p = ph - Math.floor(ph);
  switch (type) {
    case "sine": return Math.sin(2 * Math.PI * p);
    case "tri": return 1 - 4 * Math.abs(p - 0.5);
    case "sq": return p < 0.5 ? 1 : -1;
    default: return 2 * p - 1;
  }
}

interface ToneOpt {
  at?: number; dur: number; f0: number; f1?: number; type?: Osc;
  amp?: number; atk?: number; tau?: number; vib?: number; vibHz?: number;
}

/** A tone gliding from f0 to f1, with a quick attack and an exponential fall. */
function tone(o: Float32Array, sr: number, t: ToneOpt): void {
  const start = Math.floor((t.at ?? 0) * sr);
  const n = Math.min(o.length - start, Math.floor(t.dur * sr));
  if (n <= 0) return;
  const ratio = (t.f1 ?? t.f0) / t.f0;
  const atk = Math.max(1e-4, t.atk ?? 0.004);
  const tau = t.tau ?? t.dur / 3;
  const amp = t.amp ?? 1;
  const type = t.type ?? "sine";
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const s = i / sr;
    let f = t.f0 * Math.pow(ratio, i / n);
    if (t.vib) f *= 1 + t.vib * Math.sin(2 * Math.PI * (t.vibHz ?? 6) * s);
    ph += f / sr;
    o[start + i] += amp * Math.min(1, s / atk) * Math.exp(-s / tau) * wave(type, ph);
  }
}

interface NoiseOpt {
  at?: number; dur: number; amp?: number; atk?: number; tau?: number;
  lp0?: number; lp1?: number; hp?: number; seed?: number;
}

/** White noise through a sweeping low-pass and an optional high-pass. */
function noise(o: Float32Array, sr: number, t: NoiseOpt): void {
  const r = rng(t.seed ?? 7);
  const start = Math.floor((t.at ?? 0) * sr);
  const n = Math.min(o.length - start, Math.floor(t.dur * sr));
  if (n <= 0) return;
  const atk = Math.max(1e-4, t.atk ?? 0.002);
  const tau = t.tau ?? t.dur / 3;
  const amp = t.amp ?? 1;
  const lp0 = Math.min(t.lp0 ?? sr * 0.45, sr * 0.45);
  const lp1 = Math.min(t.lp1 ?? lp0, sr * 0.45);
  const ah = t.hp ? Math.exp((-2 * Math.PI * t.hp) / sr) : 0;
  let lp = 0;
  let hp = 0;
  let prev = 0;
  for (let i = 0; i < n; i++) {
    const s = i / sr;
    const fc = lp0 * Math.pow(lp1 / lp0, i / n);
    lp += (1 - Math.exp((-2 * Math.PI * fc) / sr)) * (r() * 2 - 1 - lp);
    let y = lp;
    if (t.hp) { hp = ah * (hp + y - prev); prev = y; y = hp; }
    o[start + i] += amp * Math.min(1, s / atk) * Math.exp(-s / tau) * y;
  }
}

/** A plucked string (Karplus-Strong): the bow's twang. */
function pluck(o: Float32Array, sr: number, at: number, f: number, dur: number, amp: number, damp: number, seed: number): void {
  const r = rng(seed);
  const size = Math.max(2, Math.round(sr / f));
  const ring = new Float32Array(size);
  for (let i = 0; i < size; i++) ring[i] = r() * 2 - 1;
  const start = Math.floor(at * sr);
  const n = Math.min(o.length - start, Math.floor(dur * sr));
  let idx = 0;
  for (let i = 0; i < n; i++) {
    const a = ring[idx];
    const b = ring[(idx + 1) % size];
    ring[idx] = damp * 0.5 * (a + b);
    idx = (idx + 1) % size;
    o[start + i] += amp * a;
  }
}

type Part = readonly [number, number, number];

/** Struck metal: inharmonic partials, each with its own decay. */
function bell(o: Float32Array, sr: number, at: number, f: number, amp: number, parts: readonly Part[]): void {
  for (const [ratio, a, tau] of parts) {
    tone(o, sr, { at, dur: tau * 6, f0: f * ratio, amp: amp * a, atk: 0.002, tau });
  }
}

function knock(o: Float32Array, sr: number, at: number, seed: number): void {
  tone(o, sr, { at, dur: 0.1, f0: 440, f1: 400, tau: 0.02, amp: 0.9 });
  tone(o, sr, { at, dur: 0.05, f0: 950, tau: 0.01, amp: 0.4, type: "tri" });
  noise(o, sr, { at, dur: 0.05, tau: 0.012, lp0: 2400, hp: 600, amp: 0.5, seed });
}

function coinPings(o: Float32Array, sr: number, count: number, seed: number): void {
  const r = rng(seed);
  for (let k = 0; k < count; k++) {
    bell(o, sr, r() * 0.22, 2600 + r() * 1600, 0.5, [[1, 1, 0.07], [1.34, 0.5, 0.05], [2.18, 0.3, 0.03]]);
  }
}

function normalize(o: Float32Array, peak: number): void {
  let m = 0;
  for (let i = 0; i < o.length; i++) m = Math.max(m, Math.abs(o[i]));
  if (m > 0) {
    const g = peak / m;
    for (let i = 0; i < o.length; i++) o[i] *= g;
  }
}

/** Soften both ends so nothing starts or stops on a click, then level it. */
function finish(o: Float32Array, sr: number, peak: number): Float32Array {
  const fi = Math.max(1, Math.floor(0.0015 * sr));
  const fo = Math.max(1, Math.floor(0.008 * sr));
  for (let i = 0; i < fi && i < o.length; i++) o[i] *= i / fi;
  for (let i = 0; i < fo && i < o.length; i++) o[o.length - 1 - i] *= i / fo;
  normalize(o, peak);
  return o;
}

export function renderSfx(id: SfxId, sr: number): Float32Array {
  const o = new Float32Array(Math.ceil(LEN[id] * sr));
  switch (id) {
    case "hit":
      noise(o, sr, { dur: 0.12, tau: 0.03, lp0: 3200, lp1: 700, amp: 0.8, seed: 11 });
      tone(o, sr, { dur: 0.16, f0: 120, f1: 55, tau: 0.05, amp: 1 });
      tone(o, sr, { dur: 0.02, f0: 1800, f1: 900, tau: 0.005, amp: 0.25, type: "tri" });
      break;
    case "whiff":
      noise(o, sr, { atk: 0.02, dur: 0.15, tau: 0.045, lp0: 900, lp1: 2600, hp: 300, amp: 0.7, seed: 12 });
      break;
    case "bow":
      pluck(o, sr, 0, 196, 0.3, 0.7, 0.993, 13);
      noise(o, sr, { at: 0.01, dur: 0.2, atk: 0.01, tau: 0.06, lp0: 5000, hp: 1500, amp: 0.35, seed: 14 });
      break;
    case "knock":
      knock(o, sr, 0, 15);
      break;
    case "hurt":
      noise(o, sr, { dur: 0.18, tau: 0.05, lp0: 1500, lp1: 350, amp: 0.8, seed: 16 });
      tone(o, sr, { dur: 0.22, f0: 150, f1: 70, tau: 0.07, amp: 1, type: "tri" });
      break;
    case "block":
      bell(o, sr, 0, 1250, 0.8, [[1, 1, 0.06], [1.47, 0.6, 0.05], [2.09, 0.45, 0.035], [2.73, 0.3, 0.025]]);
      noise(o, sr, { dur: 0.03, tau: 0.008, hp: 2000, amp: 0.5, seed: 17 });
      break;
    case "death":
      tone(o, sr, { dur: 1.2, f0: 220, f1: 55, tau: 0.45, amp: 0.8, type: "tri" });
      tone(o, sr, { at: 0.05, dur: 1.0, f0: 110, f1: 40, tau: 0.4, amp: 0.6 });
      noise(o, sr, { dur: 1.2, tau: 0.5, lp0: 400, lp1: 120, amp: 0.9, seed: 18 });
      break;
    case "kill":
      noise(o, sr, { dur: 0.3, tau: 0.09, lp0: 1800, lp1: 200, amp: 0.9, seed: 19 });
      tone(o, sr, { dur: 0.3, f0: 170, f1: 55, tau: 0.1, amp: 0.9, type: "tri" });
      break;
    case "levelup": {
      const notes = [523, 659, 784, 1047];
      notes.forEach((f, k) => {
        tone(o, sr, { at: k * 0.09, dur: 0.6, f0: f, tau: 0.22, amp: 0.6 });
        tone(o, sr, { at: k * 0.09, dur: 0.4, f0: f * 2, tau: 0.12, amp: 0.2 });
      });
      noise(o, sr, { at: 0.25, dur: 0.5, atk: 0.05, tau: 0.2, hp: 5000, amp: 0.12, seed: 20 });
      break;
    }
    case "skillup":
      [784, 1175].forEach((f, k) => {
        tone(o, sr, { at: k * 0.1, dur: 0.35, f0: f, tau: 0.15, amp: 0.6 });
        tone(o, sr, { at: k * 0.1, dur: 0.25, f0: f * 2, tau: 0.08, amp: 0.2 });
      });
      break;
    case "chop":
      tone(o, sr, { dur: 0.12, f0: 240, f1: 200, tau: 0.03, amp: 0.8 });
      noise(o, sr, { dur: 0.08, tau: 0.02, lp0: 1400, hp: 400, amp: 0.7, seed: 21 });
      tone(o, sr, { dur: 0.1, f0: 90, f1: 60, tau: 0.03, amp: 0.6 });
      break;
    case "mine":
      bell(o, sr, 0, 2300, 0.6, [[1, 1, 0.04], [1.53, 0.7, 0.03], [2.41, 0.5, 0.02]]);
      noise(o, sr, { dur: 0.04, tau: 0.01, hp: 2500, amp: 0.5, seed: 22 });
      tone(o, sr, { dur: 0.1, f0: 120, f1: 80, tau: 0.03, amp: 0.5 });
      break;
    case "heal":
      tone(o, sr, { dur: 0.65, f0: 523, f1: 880, atk: 0.08, tau: 0.3, amp: 0.55 });
      tone(o, sr, { dur: 0.6, f0: 1046, f1: 1760, atk: 0.1, tau: 0.25, amp: 0.2 });
      noise(o, sr, { atk: 0.1, dur: 0.5, tau: 0.2, hp: 4000, amp: 0.1, seed: 23 });
      break;
    case "buff":
      tone(o, sr, { dur: 0.3, f0: 330, f1: 700, atk: 0.01, tau: 0.15, amp: 0.6, type: "tri" });
      tone(o, sr, { at: 0.12, dur: 0.35, f0: 1318, tau: 0.14, amp: 0.3 });
      break;
    case "mire":
      tone(o, sr, { dur: 0.55, f0: 200, f1: 90, tau: 0.25, amp: 0.8, vib: 0.08, vibHz: 9 });
      noise(o, sr, { dur: 0.5, tau: 0.2, lp0: 500, lp1: 200, amp: 0.5, seed: 24 });
      break;
    case "fury":
      tone(o, sr, { dur: 0.6, f0: 90, f1: 180, atk: 0.05, tau: 0.3, amp: 0.7, type: "saw" });
      noise(o, sr, { dur: 0.5, atk: 0.1, tau: 0.2, lp0: 300, lp1: 2500, amp: 0.5, seed: 25 });
      break;
    case "cast":
      noise(o, sr, { dur: 0.45, atk: 0.08, tau: 0.15, lp0: 500, lp1: 3500, hp: 200, amp: 0.8, seed: 26 });
      tone(o, sr, { dur: 0.4, f0: 400, f1: 900, atk: 0.05, tau: 0.15, amp: 0.3 });
      break;
    case "rune":
      noise(o, sr, { dur: 0.4, atk: 0.05, tau: 0.15, lp0: 300, lp1: 1800, amp: 0.6, seed: 27 });
      tone(o, sr, { at: 0.3, dur: 0.45, f0: 110, f1: 45, tau: 0.12, amp: 1 });
      noise(o, sr, { at: 0.3, dur: 0.3, tau: 0.08, lp0: 1500, lp1: 300, amp: 0.7, seed: 28 });
      break;
    case "portal":
      [300, 450, 600].forEach((f) => {
        tone(o, sr, { dur: 0.9, f0: f, f1: f * 3, atk: 0.15, tau: 0.35, amp: 0.25, vib: 0.01, vibHz: 7 });
      });
      noise(o, sr, { dur: 0.8, atk: 0.2, tau: 0.3, hp: 3000, amp: 0.15, seed: 29 });
      break;
    case "eat":
      noise(o, sr, { dur: 0.06, tau: 0.02, lp0: 3000, hp: 800, amp: 0.8, seed: 30 });
      noise(o, sr, { at: 0.12, dur: 0.06, tau: 0.02, lp0: 2600, hp: 700, amp: 0.7, seed: 31 });
      break;
    case "coins":
      coinPings(o, sr, 5, 32);
      break;
    case "reward":
      coinPings(o, sr, 3, 33);
      [784, 988, 1175].forEach((f, k) => {
        tone(o, sr, { at: 0.05 + k * 0.08, dur: 0.6, f0: f, tau: 0.25, amp: 0.45 });
      });
      break;
    case "splash": {
      noise(o, sr, { atk: 0.005, dur: 0.45, tau: 0.12, lp0: 2200, lp1: 700, amp: 0.8, seed: 34 });
      const r = rng(35);
      for (let k = 0; k < 5; k++) {
        const f = 500 + r() * 700;
        tone(o, sr, { at: r() * 0.3, dur: 0.05, f0: f, f1: f * 1.6, tau: 0.015, amp: 0.3 });
      }
      break;
    }
    case "build":
      knock(o, sr, 0, 36);
      knock(o, sr, 0.15, 37);
      knock(o, sr, 0.3, 38);
      break;
    case "forge": {
      const clang: readonly Part[] = [[1, 1, 0.25], [1.5, 0.6, 0.18], [2.02, 0.5, 0.12], [2.95, 0.3, 0.08]];
      bell(o, sr, 0, 520, 0.8, clang);
      noise(o, sr, { dur: 0.03, tau: 0.008, hp: 1500, amp: 0.5, seed: 39 });
      bell(o, sr, 0.3, 540, 0.45, clang);
      break;
    }
    case "chime":
      bell(o, sr, 0, 1319, 0.6, [[1, 1, 0.3], [2, 0.3, 0.15], [3, 0.12, 0.08]]);
      bell(o, sr, 0.12, 988, 0.4, [[1, 1, 0.3], [2, 0.25, 0.12]]);
      break;
    case "mobheal":
      tone(o, sr, { dur: 0.45, f0: 440, f1: 660, atk: 0.06, tau: 0.2, amp: 0.5 });
      tone(o, sr, { dur: 0.4, f0: 880, f1: 1320, atk: 0.08, tau: 0.16, amp: 0.15 });
      break;
  }
  return finish(o, sr, 0.9);
}

/** Surf on a beach: brown noise that swells and breaks, with foam on top. */
function seaBed(o: Float32Array, sr: number, L: number): void {
  const r = rng(41);
  const ah = Math.exp((-2 * Math.PI * 1800) / sr);
  let br = 0, lp = 0, hp = 0, prev = 0, soft = 0;
  for (let i = 0; i < o.length; i++) {
    const t = i / sr;
    const s1 = 0.5 + 0.5 * Math.sin((2 * Math.PI * t) / (L / 2) - 1.2);
    const s2 = 0.5 + 0.5 * Math.sin((2 * Math.PI * t) / (L / 3) + 0.7);
    const swell = 0.6 * s1 * s1 + 0.4 * s2 * s2;
    const w = r() * 2 - 1;
    br = (br + 0.02 * w) * 0.997;
    const fc = 250 + 900 * swell;
    lp += (1 - Math.exp((-2 * Math.PI * fc) / sr)) * (br * 4 - lp);
    hp = ah * (hp + w - prev);
    prev = w;
    soft += 0.35 * (hp - soft);
    o[i] = lp * (0.25 + 0.75 * swell) + soft * 0.35 * swell * swell * swell;
  }
}

/** A cave: a low rumble, a draught, and water dripping with an echo. */
function caveBed(o: Float32Array, sr: number, L: number): void {
  const r = rng(53);
  const a = 1 - Math.exp((-2 * Math.PI * 110) / sr);
  const aw = 1 - Math.exp((-2 * Math.PI * 450) / sr);
  let br = 0, lp = 0, wind = 0;
  for (let i = 0; i < o.length; i++) {
    const t = i / sr;
    const w = r() * 2 - 1;
    br = (br + 0.02 * w) * 0.998;
    lp += a * (br * 5 - lp);
    wind += aw * (w - wind);
    const wob = 0.75 + 0.25 * Math.sin((2 * Math.PI * t) / (L / 2));
    o[i] = lp * 0.25 * wob + wind * 0.15 * (1.5 - wob);
  }
  const drips = 8;
  const span = (L - 1) / drips;
  const echoes: readonly (readonly [number, number])[] = [[0, 1], [0.23, 0.35], [0.47, 0.14]];
  for (let k = 0; k < drips; k++) {
    const at = 1 + (k + 0.15 + r() * 0.7) * span;
    const f = 1400 + r() * 1000;
    for (const [dly, g] of echoes) {
      tone(o, sr, { at: at + dly, dur: 0.12, f0: f, f1: f * 0.55, tau: 0.03, amp: 0.5 * g, atk: 0.002 });
    }
  }
}

/** Bonetown: gulls' cousins in the eaves, a breeze, the harbour far off. */
function townBed(o: Float32Array, sr: number, L: number): void {
  const r = rng(67);
  const as = 1 - Math.exp((-2 * Math.PI * 300) / sr);
  const aw = 1 - Math.exp((-2 * Math.PI * 600) / sr);
  let br = 0, surf = 0, wind = 0;
  for (let i = 0; i < o.length; i++) {
    const t = i / sr;
    const w = r() * 2 - 1;
    br = (br + 0.02 * w) * 0.997;
    surf += as * (br * 4 - surf);
    wind += aw * (w - wind);
    const swell = 0.5 + 0.5 * Math.sin((2 * Math.PI * t) / (L / 4));
    const gust = 0.5 + 0.5 * Math.sin((2 * Math.PI * t) / (L / 2) + 2);
    o[i] = surf * 0.18 * (0.4 + 0.6 * swell) + wind * 0.5 * gust;
  }
  const phrases = 7;
  const span = (L - 2) / phrases;
  for (let k = 0; k < phrases; k++) {
    let at = 1 + (k + r() * 0.7) * span;
    const base = 2600 + r() * 1500;
    const notes = 2 + Math.floor(r() * 4);
    for (let j = 0; j < notes; j++) {
      const f0 = base * (0.9 + r() * 0.2);
      tone(o, sr, { at, dur: 0.09, f0, f1: f0 * (1.15 + r() * 0.2), tau: 0.03, amp: 0.3, atk: 0.005 });
      at += 0.07 + r() * 0.05;
    }
  }
}

export function renderAmbient(id: AmbientId, sr: number): Float32Array {
  const L = AMBIENT_LOOP_S[id];
  const n = Math.round(L * sr);
  const xf = Math.round(sr);
  const raw = new Float32Array(n + xf);
  if (id === "sea") seaBed(raw, sr, L);
  else if (id === "cave") caveBed(raw, sr, L);
  else townBed(raw, sr, L);
  const out = new Float32Array(n);
  out.set(raw.subarray(0, n));
  for (let i = 0; i < xf; i++) {
    const k = (i / xf) * (Math.PI / 2);
    out[i] = raw[i] * Math.sin(k) + raw[n + i] * Math.cos(k);
  }
  normalize(out, 0.8);
  return out;
}
