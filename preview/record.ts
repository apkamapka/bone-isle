/** Dev-only: run the real chrome primitives against a recording ctx. */
import { panelFrame, raisedBox, slotCell, buttonBox, CHROME, frameInset } from "../src/ui/chrome.ts";

interface Rect { x: number; y: number; w: number; h: number; c: string }
const out: Rect[] = [];
let cur = "#000";
const ctx = {
  set fillStyle(v: string) { cur = v; },
  get fillStyle() { return cur; },
  fillRect(x: number, y: number, w: number, h: number) { out.push({ x, y, w, h, c: cur }); },
} as unknown as CanvasRenderingContext2D;

const S = 2;
const inset = frameInset(S);

// A backpack window: frame, title bar, 4x4 grid of slots, one button.
const W = 190, H = 150;
panelFrame(ctx, 10, 10, W, H, S);
raisedBox(ctx, 10 + inset, 10 + inset, W - 2 * inset, 14 * S - inset,
  CHROME.barFace, CHROME.barLight, CHROME.barDark, S);
for (let i = 0; i < 16; i++) {
  const cx = 22 + (i % 4) * 42;
  const cy = 48 + Math.floor(i / 4) * 24;
  slotCell(ctx, cx, cy, 38, 20, S, {
    hover: i === 5,
    accent: i === 0 ? CHROME.slotFilled : i === 2 ? CHROME.gold : undefined,
  });
}
buttonBox(ctx, 22, 144, 60, 12, S, {});
buttonBox(ctx, 90, 144, 60, 12, S, { on: true, face: "rgba(202,162,58,.30)", accent: CHROME.gold });


// Same window at S=1 (small screens): the bevels must not eat small boxes.
const S1 = 1;
panelFrame(ctx, 220, 10, 120, 90, S1);
raisedBox(ctx, 220 + frameInset(S1), 10 + frameInset(S1), 120 - 2 * frameInset(S1), 14 - frameInset(S1),
  CHROME.barFace, CHROME.barLight, CHROME.barDark, S1);
for (let i = 0; i < 12; i++) {
  slotCell(ctx, 226 + (i % 4) * 28, 30 + Math.floor(i / 4) * 20, 24, 16, S1,
    { accent: i === 1 ? CHROME.gold : i === 2 ? CHROME.slotFilled : undefined });
}
buttonBox(ctx, 226, 88, 50, 10, S1, {});
buttonBox(ctx, 282, 88, 50, 10, S1, { on: true, accent: CHROME.gold });

console.log(JSON.stringify(out));
