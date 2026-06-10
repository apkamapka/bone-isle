/** Floating text numbers (damage, xp, pickups) that drift up and fade. */
import { rnd } from "./util.ts";
import type { World } from "./world/types.ts";

export interface FloatText {
  x: number;
  y: number;
  text: string;
  color: string;
  t: number;
  /** Which world this belongs to, so we don't draw it on the other island. */
  world: World;
}

const floats: FloatText[] = [];

export function addFloat(world: World, x: number, y: number, text: string, color: string): void {
  floats.push({ x: x + rnd(-3, 3), y, text, color, t: 1.1, world });
}

export function updateFloats(dt: number): void {
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i];
    f.t -= dt;
    f.y -= 14 * dt;
    if (f.t <= 0) floats.splice(i, 1);
  }
}

/** Draw all floats belonging to `world`, offset by the camera. */
export function drawFloats(
  vctx: CanvasRenderingContext2D,
  world: World,
  camX: number,
  camY: number,
): void {
  vctx.font = "bold 7px monospace";
  vctx.textAlign = "center";
  for (const f of floats) {
    if (f.world !== world) continue;
    vctx.globalAlpha = Math.min(1, f.t * 2);
    vctx.fillStyle = "#000";
    vctx.fillText(f.text, Math.floor(f.x - camX) + 1, Math.floor(f.y - camY) + 1);
    vctx.fillStyle = f.color;
    vctx.fillText(f.text, Math.floor(f.x - camX), Math.floor(f.y - camY));
  }
  vctx.globalAlpha = 1;
}
