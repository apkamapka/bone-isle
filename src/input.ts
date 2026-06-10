/** Keyboard + mouse input. Keeps a live key map and reports world clicks. */
import type { Vec } from "./world/types.ts";

const keys: Record<string, boolean> = {};

export function isDown(...names: string[]): boolean {
  return names.some((n) => keys[n]);
}

/** Directional input from WASD / arrow keys as a (possibly zero) vector. */
export function moveAxis(): { dx: number; dy: number } {
  let dx = 0;
  let dy = 0;
  if (isDown("w", "arrowup")) dy--;
  if (isDown("s", "arrowdown")) dy++;
  if (isDown("a", "arrowleft")) dx--;
  if (isDown("d", "arrowright")) dx++;
  return { dx, dy };
}

export interface InputHandlers {
  /** Convert a screen-space click to a world-space point. */
  toWorld: (sx: number, sy: number) => Vec;
  /** Called with the world-space click position. */
  onClick: (world: Vec) => void;
}

/** Wire up listeners against a canvas. Returns nothing; state is module-level. */
export function initInput(canvas: HTMLCanvasElement, h: InputHandlers): void {
  addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault();
    keys[k] = true;
  });
  addEventListener("keyup", (e) => {
    keys[e.key.toLowerCase()] = false;
  });
  canvas.addEventListener("mousedown", (e) => {
    const r = canvas.getBoundingClientRect();
    h.onClick(h.toWorld(e.clientX - r.left, e.clientY - r.top));
  });
}
