/** Dev-only: the resize foot, idle and hovered. */
import { drawResizeArrows } from "../src/ui/icons.ts";
import { panelFrame, raisedBox, slotCell, CHROME, frameInset } from "../src/ui/chrome.ts";

interface R { x: number; y: number; w: number; h: number; c: string }
const out: R[] = [];
let cur = "#000";
const ctx = {
  set fillStyle(v: string) { cur = v; },
  get fillStyle() { return cur; },
  fillRect(x: number, y: number, w: number, h: number) { out.push({ x, y, w, h, c: cur }); },
} as unknown as CanvasRenderingContext2D;

const S = 1.25;
const W = 205;
[false, true].forEach((hot, n) => {
  const x = 8 + n * (W + 16);
  const y = 8;
  const cell = 32 * S, gap = 4 * S, rows = 2;
  const bar = 6 * 1.6 * S;
  const h = 20 * S + rows * cell + (rows - 1) * gap + 20 * S + 6 * S;
  panelFrame(ctx, x, y, W, h, S);
  raisedBox(ctx, x + frameInset(S), y + frameInset(S), W - 2 * frameInset(S), 14 * S - frameInset(S),
    CHROME.barFace, CHROME.barLight, CHROME.barDark, S);
  const gw = 4 * cell + 3 * gap;
  const gx = x + (W - gw) / 2;
  for (let i = 0; i < 8; i++) {
    slotCell(ctx, gx + (i % 4) * (cell + gap), y + 20 * S + Math.floor(i / 4) * (cell + gap),
      cell, cell, S, { accent: i < 3 ? CHROME.slotFilled : undefined });
  }
  const by = y + h - bar;
  if (hot) { ctx.fillStyle = "rgba(202,162,58,.22)"; ctx.fillRect(Math.round(x), Math.round(by), Math.round(W), Math.round(bar)); }
  drawResizeArrows(ctx, x + W / 2, by + bar / 2, bar, hot ? "#ffe9a8" : "rgba(255,233,168,.42)");
});
console.log(JSON.stringify(out));
