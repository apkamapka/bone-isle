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

/**
 * How many slots one row of function keys reaches, and therefore what Shift
 * adds. Twelve because that is how many F-keys a keyboard has; the hotbar's
 * own ceiling (24) is exactly two rows of them, which is not a coincidence —
 * it is why the shift row is enough and no third modifier is needed.
 */
export const SPELL_KEY_ROW = 12;

/** The label for action slot `i`, as the keyboard reaches it. */
export function spellKeyLabel(i: number): string {
  if (i < 0 || i >= SPELL_KEY_ROW * 2) return "";
  return (i >= SPELL_KEY_ROW ? "\u21e7F" : "F") + ((i % SPELL_KEY_ROW) + 1);
}

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
  /** Open (or close) the chat input. */
  onChat: () => void;
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
    // ENTER opens chat, the way it does in every game with a chat. The field
    // itself swallows keydown while focused, so `w` types a w rather than
    // walking north — see ui/chatInput.ts.
    else if (k === "enter") h.onChat();
    /* THE HOTBAR LIVES ON THE FUNCTION KEYS.
     *
     * The bar holds twenty-four slots and the digit row holds ten, so under
     * the old scheme fourteen of them were mouse-only — and worse, there was
     * no key that could MEAN twelve: pressing 1 then 2 fires slot one twice.
     * A number that cannot be typed is not a shortcut, it is a label.
     *
     * F1-F12 covers the first twelve and Shift+F1-F12 the rest, which is the
     * whole bar with one modifier and no ambiguity. The digits stay wired to
     * the first ten underneath, because a hand that already knows them should
     * not have to relearn anything to keep playing.
     *
     * `preventDefault` is not optional here: F1 is the browser's help, F3 its
     * find bar, F5 a reload and F11 fullscreen. Firing a spell and reloading
     * the page on the same press is the worst version of this feature. */
    const fn = /^f([1-9]|1[0-2])$/.exec(k);
    if (fn) {
      e.preventDefault();
      const row = e.shiftKey ? SPELL_KEY_ROW : 0;
      h.onSpell(row + Number(fn[1]) - 1);
      keys[k] = true;
      return;
    }
    /* THE DIGITS ARE GONE. They reached ten of the twenty-four slots and were
     * printed on none of them — the same fault as the numbering they replaced,
     * only inverted: before, a slot showed a key that could not be pressed;
     * after, a key worked that no slot showed. One scheme, written on the
     * bar. */
    if (k === "escape") h.onEscape();
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
