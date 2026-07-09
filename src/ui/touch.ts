/** Mobile touch: a left-side virtual joystick + tap passthrough for the rest. */

export interface TouchState {
  /** Normalized joystick vector (-1..1), zero when not held. */
  jx: number;
  jy: number;
  active: boolean;
  /** Joystick base + knob position in DEVICE px (matches the HUD space). */
  baseX: number;
  baseY: number;
  knobX: number;
  knobY: number;
  /** Joystick radius in device px (set on touch-start from screen size). */
  radius: number;
}

export const touch: TouchState = { jx: 0, jy: 0, active: false, baseX: 0, baseY: 0, knobX: 0, knobY: 0, radius: 60 };

/** True on touch-first devices (used to show the joystick + bigger hit areas). */
export function isTouchDevice(): boolean {
  return typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0);
}

/**
 * Wire touch handlers. A touch that starts on the left ~45% and lower ~65% of
 * the screen drives a floating joystick (its base appears where you press);
 * every other touch is forwarded to `onTap` as a world/HUD tap in device px.
 *
 * `blocked(sx,sy)` lets the caller veto joystick activation (e.g. when the
 * press lands on an on-screen button or an open panel).
 */
export function initTouch(
  canvas: HTMLCanvasElement,
  onTap: (sx: number, sy: number) => void,
  blocked?: (sx: number, sy: number) => boolean,
): void {
  let joyId: number | null = null;
  let joyStart = { x: 0, y: 0, t: 0, moved: false };

  const toDevice = (t: Touch): { x: number; y: number } => {
    const r = canvas.getBoundingClientRect();
    const kx = r.width ? canvas.width / r.width : 1;
    const ky = r.height ? canvas.height / r.height : 1;
    return { x: (t.clientX - r.left) * kx, y: (t.clientY - r.top) * ky };
  };

  canvas.addEventListener("touchstart", (e) => {
    for (const t of Array.from(e.changedTouches)) {
      const { x, y } = toDevice(t);
      const inJoyZone = x < canvas.width * 0.45 && y > canvas.height * 0.35;
      if (joyId === null && inJoyZone && !(blocked && blocked(x, y))) {
        joyId = t.identifier;
        joyStart = { x, y, t: Date.now(), moved: false };
        touch.active = true;
        touch.radius = Math.max(48, Math.min(canvas.width, canvas.height) * 0.13);
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
      const { x, y } = toDevice(t);
      let dx = x - touch.baseX;
      let dy = y - touch.baseY;
      const d = Math.hypot(dx, dy);
      if (d > touch.radius * 0.22) joyStart.moved = true;
      const R = touch.radius;
      if (d > R) { dx = (dx / d) * R; dy = (dy / d) * R; }
      touch.knobX = touch.baseX + dx;
      touch.knobY = touch.baseY + dy;
      touch.jx = dx / R;
      touch.jy = dy / R;
    }
    e.preventDefault();
  }, { passive: false });

  const end = (e: TouchEvent): void => {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === joyId) {
        // a quick, still press in the joystick zone counts as a tap-to-interact
        if (!joyStart.moved && Date.now() - joyStart.t < 250) onTap(joyStart.x, joyStart.y);
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

/** Draw the joystick overlay in screen (device px) space. */
export function drawJoystick(ctx: CanvasRenderingContext2D): void {
  if (!touch.active) return;
  const R = touch.radius;
  ctx.save();
  ctx.beginPath();
  ctx.arc(touch.baseX, touch.baseY, R, 0, 6.2832);
  ctx.fillStyle = "rgba(255,255,255,.08)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,.30)";
  ctx.lineWidth = Math.max(2, R * 0.05);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(touch.knobX, touch.knobY, R * 0.42, 0, 6.2832);
  ctx.fillStyle = "rgba(202,162,58,.75)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,233,168,.6)";
  ctx.lineWidth = Math.max(1, R * 0.03);
  ctx.stroke();
  ctx.restore();
}
