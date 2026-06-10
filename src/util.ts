/** Tiny shared helpers used across the game. */

export const rnd = (a: number, b: number): number => a + Math.random() * (b - a);

export const rndi = (a: number, b: number): number => Math.floor(rnd(a, b + 1));

export const clamp = (v: number, a: number, b: number): number =>
  v < a ? a : v > b ? b : v;

export const dist = (ax: number, ay: number, bx: number, by: number): number =>
  Math.hypot(ax - bx, ay - by);
