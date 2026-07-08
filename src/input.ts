/** Keyboard + mouse input. Live key map, click + move tracking, hotkeys. */
import { touch } from "./ui/touch.ts";
import type { Vec } from "./world/types.ts";

const keys: Record<string, boolean> = {};

export function isDown(...names: string[]): boolean {
  return names.some((n) => keys[n]);
}

/** Directional input from WASD / arrows plus the touch joystick. */
export function moveAxis(): { dx: number; dy: number } {
  let dx = 0;
  let dy = 0;
  if (isDown("w", "arrowup")) dy--;
  if (isDown("s", "arrowdown")) dy++;
  if (isDown("a", "arrowleft")) dx--;
  if (isDown("d", "arrowright")) dx++;
  if (touch.active && (Math.abs(touch.jx) > 0.15 || Math.abs(touch.jy) > 0.15)) {
    dx += touch.jx;
    dy += touch.jy;
  }
  return { dx, dy };
}

export type PanelName = "build" | "skills" | "equip" | "bag" | "quest";

export interface InputHandlers {
  toWorld: (sx: number, sy: number) => Vec;
  onClick: (screen: { sx: number; sy: number }, world: Vec) => void;
  onMove?: (sx: number, sy: number) => void;
  onPanel: (which: PanelName) => void;
  onSpell: (index: number) => void;
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
    else if (k === "i") h.onPanel("bag");
    else if (k === "q") h.onPanel("quest");
    else if (k === "1") h.onSpell(0);
    else if (k === "2") h.onSpell(1);
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
