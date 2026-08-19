/** Dev-only: a shortened container with its scrollbar, at column scale. */
import { drawResizeArrows } from "../src/ui/icons.ts";
import { panelFrame, raisedBox, sunkenBox, buttonBox, slotCell, CHROME, frameInset } from "../src/ui/chrome.ts";

interface R { x: number; y: number; w: number; h: number; c: string }
const out: R[] = [];
let cur = "#000";
const ctx = {
  set fillStyle(v: string) { cur = v; },
  get fillStyle() { return cur; },
  fillRect(x: number, y: number, w: number, h: number) { out.push({ x, y, w, h, c: cur }); },
} as unknown as CanvasRenderingContext2D;

const S = 1.25, W = 205, SB = 9;
[0, 2].forEach((at, n) => {
  const x = 8 + n * (W + 16), y = 8;
  const cell = 32 * S, gap = 4 * S, rows = 2, allRows = 4;
  const bar = 6 * 1.6 * S;
  const h = 20 * S + rows * cell + (rows - 1) * gap + 20 * S + 6 * S;
  panelFrame(ctx, x, y, W, h, S);
  raisedBox(ctx, x + frameInset(S), y + frameInset(S), W - 2 * frameInset(S), 14 * S - frameInset(S),
    CHROME.barFace, CHROME.barLight, CHROME.barDark, S);
  const gw = 4 * cell + 3 * gap;
  const gx = x + (W - gw) / 2, gy = y + 20 * S;
  for (let i = 0; i < 8; i++) {
    slotCell(ctx, gx + (i % 4) * (cell + gap), gy + Math.floor(i / 4) * (cell + gap), cell, cell, S,
      { accent: (at * 4 + i) % 3 === 0 ? CHROME.slotFilled : undefined });
  }
  // scrollbar
  const bx = x + W - (SB + 2) * S, bh = rows * (cell + gap) - gap, bw = SB * S, btn = bw;
  sunkenBox(ctx, bx, gy + btn, bw, bh - 2 * btn, CHROME.slotFace, CHROME.slotDark, CHROME.slotLight, S);
  buttonBox(ctx, bx, gy, bw, btn, S, { accent: at > 0 ? CHROME.gold : undefined });
  buttonBox(ctx, bx, gy + bh - btn, bw, btn, S, { accent: at < allRows - rows ? CHROME.gold : undefined });
  const track = bh - 2 * btn;
  const th = Math.max(6 * S, (track * rows) / allRows);
  const ty = gy + btn + ((track - th) * at) / (allRows - rows);
  raisedBox(ctx, bx + S, ty, bw - 2 * S, th, "rgba(202,162,58,.55)", CHROME.gold, "#3a2c0e", S);
  drawResizeArrows(ctx, x + W / 2, y + h - bar / 2, bar, "rgba(255,233,168,.45)");
});
console.log(JSON.stringify(out));
