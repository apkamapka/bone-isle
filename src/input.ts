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
  onClick: (screen: { sx: number; sy: number; button: number }, world: Vec) => void;
  onMove?: (sx: number, sy: number) => void;
  onPanel: (which: PanelName) => void;
  onSpell: (index: number) => void;
  onLook: () => void;
  /** Cycle the attack stance (offensive → balanced → defensive). */
  onStance: () => void;
  /** Toggle chase opponent / stand while fighting. */
  onChase: () => void;
  /** Mark the nearest creature, or drop the mark if one is already held. */
  onAttackNearest: () => void;
  onEscape: () => void;
}

/**
 * Wire up listeners. Movement keys (WASD/arrows) never double as panel
 * hotkeys — Skills lives on `K`, so holding `S` to walk south never pops
 * the panel. The three combat controls sit on `X` (stance), `C` (chase) and
 * SPACE (attack nearest): a combat control wants a key you can reach without
 * letting go of the movement hand.
 */
export function initInput(canvas: HTMLCanvasElement, h: InputHandlers): void {
  addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault();
    if (e.repeat) {
      keys[k] = true;
      return;
    }
    if (k === "b") h.onPanel("build");
    else if (k === "k") h.onPanel("skills");
    else if (k === "e") h.onPanel("equip");
    else if (k === "i") h.onPanel("bag");
    else if (k === "q") h.onPanel("quest");
    else if (k === "l") h.onLook();
    else if (k === "x") h.onStance();
    // C for chase and SPACE for "attack nearest" — both sit under the hand
    // that is not walking, because both are pressed mid-fight.
    else if (k === "c") h.onChase();
    else if (k === " ") h.onAttackNearest();
    else if (k === "1") h.onSpell(0);
    else if (k === "2") h.onSpell(1);
    else if (k === "3") h.onSpell(2);
    else if (k === "4") h.onSpell(3);
    else if (k === "5") h.onSpell(4);
    else if (k === "6") h.onSpell(5);
    else if (k === "escape") h.onEscape();
    keys[k] = true;
  });

  addEventListener("keyup", (e) => {
    keys[e.key.toLowerCase()] = false;
  });

  const toDevice = (clientX: number, clientY: number): { sx: number; sy: number } => {
    const r = canvas.getBoundingClientRect();
    const kx = r.width ? canvas.width / r.width : 1;
    const ky = r.height ? canvas.height / r.height : 1;
    return { sx: (clientX - r.left) * kx, sy: (clientY - r.top) * ky };
  };

  canvas.addEventListener("mousemove", (e) => {
    const { sx, sy } = toDevice(e.clientX, e.clientY);
    h.onMove?.(sx, sy);
  });

  canvas.addEventListener("mousedown", (e) => {
    const { sx, sy } = toDevice(e.clientX, e.clientY);
    h.onClick({ sx, sy, button: e.button }, h.toWorld(sx, sy));
  });
}
