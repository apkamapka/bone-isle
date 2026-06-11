/** Keyboard + mouse input. Live key map, click + move tracking, panel keys. */
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
  /** A click at screen position (sx,sy) and the resolved world position. */
  onClick: (screen: { sx: number; sy: number }, world: Vec) => void;
  /** Mouse moved to screen position (sx,sy). */
  onMove?: (sx: number, sy: number) => void;
  /** Toggle a panel: "build" | "skills" | "equip". */
  onPanel: (which: "build" | "skills" | "equip") => void;
  /** Escape pressed. */
  onEscape: () => void;
}

/**
 * Wire up listeners. The `S` key is shared with downward movement, so a quick
 * tap toggles the Skills panel while holding it walks the player down.
 */
export function initInput(canvas: HTMLCanvasElement, h: InputHandlers): void {
  let sDownAt = 0;

  addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault();
    if (e.repeat) {
      keys[k] = true;
      return;
    }
    if (k === "b") h.onPanel("build");
    else if (k === "s") sDownAt = performance.now();
    else if (k === "e") h.onPanel("equip");
    else if (k === "escape") h.onEscape();
    keys[k] = true;
  });

  addEventListener("keyup", (e) => {
    const k = e.key.toLowerCase();
    if (k === "s") {
      if (sDownAt && performance.now() - sDownAt < 250) h.onPanel("skills");
      sDownAt = 0;
    }
    keys[k] = false;
  });

  canvas.addEventListener("mousemove", (e) => {
    const r = canvas.getBoundingClientRect();
    h.onMove?.(e.clientX - r.left, e.clientY - r.top);
  });

  canvas.addEventListener("mousedown", (e) => {
    const r = canvas.getBoundingClientRect();
    const sx = e.clientX - r.left;
    const sy = e.clientY - r.top;
    h.onClick({ sx, sy }, h.toWorld(sx, sy));
  });
}
