/** Tiny shared helpers used across the game. */

/** Seedable PRNG (mulberry32) — deterministic world generation for saves. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The world-generation RNG. Re-seeded by game.ts before generating. */
export let wrand: () => number = Math.random;
export function seedWorldRng(seed: number): void {
  wrand = mulberry32(seed);
}

/** Uniform float in [a,b) using the world RNG. */
export const wrnd = (a: number, b: number): number => a + wrand() * (b - a);
/** Uniform int in [a,b] using the world RNG. */
export const wrndi = (a: number, b: number): number => Math.floor(wrnd(a, b + 1));

/** Non-deterministic helpers (visual jitter, combat rolls). */
export const rnd = (a: number, b: number): number => a + Math.random() * (b - a);
export const rndi = (a: number, b: number): number => Math.floor(rnd(a, b + 1));

export const clamp = (v: number, a: number, b: number): number =>
  v < a ? a : v > b ? b : v;

export const dist = (ax: number, ay: number, bx: number, by: number): number =>
  Math.hypot(ax - bx, ay - by);
