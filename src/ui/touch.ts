/** Mobile touch: a left-side virtual joystick + tap passthrough for the rest. */

export interface TouchState {
  /** Normalized joystick vector (-1..1), zero when not held. */
  jx: number;
  jy: number;
  active: boolean;
  /** Joystick base position in screen px (set on touch-start). */
  baseX: number;
  baseY: number;
  knobX: number;
  knobY: number;
}

export const touch: TouchState = { jx: 0, jy: 0, active: false, baseX: 0, baseY: 0, knobX: 0, knobY: 0 };

/** True on touch-first devices (used to show the joystick + bigger hit areas). */
export function isTouchDevice(): boolean {
  return typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0);
}

const MAX_R = 46;

/**
 * Wire touch handlers. A touch that starts on the left third of the screen
 * drives the joystick; taps elsewhere are forwarded to `onTap` (world clicks).
 */
export function initTouch(
  canvas: HTMLCanvasElement,
  onTap: (sx: number, sy: number) => void,
): void {
  let joyId: number | null = null;

  const local = (t: Touch): { x: number; y: number } => {
    const r = canvas.getBoundingClientRect();
    return { x: t.clientX - r.left, y: t.clientY - r.top };
  };

  canvas.addEventListener("touchstart", (e) => {
    for (const t of Array.from(e.changedTouches)) {
      const { x, y } = local(t);
      if (joyId === null && x < canvas.width * 0.4) {
        joyId = t.identifier;
        touch.active = true;
        touch.baseX = x;
        touch.baseY = y;
        touch.knobX = x;
        touch.knobY = y;
        touch.jx = 0;
        touch.jy = 0;
      } else {
        onTap(x, y);
      }
    }
    e.preventDefault();
  }, { passive: false });

  canvas.addEventListener("touchmove", (e) => {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier !== joyId) continue;
      const { x, y } = local(t);
      let dx = x - touch.baseX;
      let dy = y - touch.baseY;
      const d = Math.hypot(dx, dy);
      if (d > MAX_R) { dx = (dx / d) * MAX_R; dy = (dy / d) * MAX_R; }
      touch.knobX = touch.baseX + dx;
      touch.knobY = touch.baseY + dy;
      touch.jx = dx / MAX_R;
      touch.jy = dy / MAX_R;
    }
    e.preventDefault();
  }, { passive: false });

  const end = (e: TouchEvent): void => {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === joyId) {
        joyId = null;
        touch.active = false;
        touch.jx = 0;
        touch.jy = 0;
      }
    }
  };
  canvas.addEventListener("touchend", end);
  canvas.addEventListener("touchcancel", end);
}

/** Draw the joystick overlay in screen space (call after HUD). */
export function drawJoystick(ctx: CanvasRenderingContext2D): void {
  if (!touch.active) return;
  ctx.save();
  ctx.beginPath();
  ctx.arc(touch.baseX, touch.baseY, MAX_R, 0, 6.2832);
  ctx.fillStyle = "rgba(255,255,255,.08)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,.28)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(touch.knobX, touch.knobY, 18, 0, 6.2832);
  ctx.fillStyle = "rgba(202,162,58,.7)";
  ctx.fill();
  ctx.restore();
}
