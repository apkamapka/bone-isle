/** Dev-only: lay out the sidebar with the real dock maths and dump rects. */
import { dockLayout, DOCK_FIT, VITALS_FIT } from "../src/ui/dock.ts";
import { panelFrame, raisedBox, slotCell, CHROME, frameInset } from "../src/ui/chrome.ts";

interface Rect { x: number; y: number; w: number; h: number; c: string }
const out: Rect[] = [];
let cur = "#000";
const ctx = {
  set fillStyle(v: string) { cur = v; },
  get fillStyle() { return cur; },
  fillRect(x: number, y: number, w: number, h: number) { out.push({ x, y, w, h, c: cur }); },
} as unknown as CanvasRenderingContext2D;

// A 1600x900 laptop, at the scale resize() would pick for it.
const W = 1600, H = 900;
const S = Math.min(W / 480, H / 320);
const d = dockLayout(W, H, S, true);

ctx.fillStyle = "#56803e"; ctx.fillRect(0, 0, W - d.w, H);           // map
ctx.fillStyle = "rgba(10,8,5,.92)"; ctx.fillRect(d.x, 0, d.w, H);     // column plate
ctx.fillStyle = CHROME.panelEdge; ctx.fillRect(d.x, 0, Math.round(S), H);

// two stacked containers, drawn at the docked scale
const Sd = S * DOCK_FIT;
let y = d.stackTop;
for (let n = 0; n < 2; n++) {
  const cell = 32 * Sd, gap = 4 * Sd;
  const rows = 4;
  const h = 20 * Sd + rows * cell + (rows - 1) * gap + 20 * Sd;
  panelFrame(ctx, d.innerX, y, d.innerW, h, Sd);
  raisedBox(ctx, d.innerX + frameInset(Sd), y + frameInset(Sd),
    d.innerW - 2 * frameInset(Sd), 14 * Sd - frameInset(Sd),
    CHROME.barFace, CHROME.barLight, CHROME.barDark, Sd);
  const gridW = 4 * cell + 3 * gap;
  const gx = d.innerX + (d.innerW - gridW) / 2;
  for (let i = 0; i < 16; i++) {
    slotCell(ctx, gx + (i % 4) * (cell + gap), y + 20 * Sd + Math.floor(i / 4) * (cell + gap),
      cell, cell, Sd, { accent: i === 3 && n === 0 ? CHROME.gold : i < 6 ? CHROME.slotFilled : undefined });
  }
  y += h + 4 * S;
}

// pinned furniture at the foot
ctx.fillStyle = "rgba(12,24,22,.82)"; ctx.fillRect(d.innerX, d.goldY, d.innerW, d.goldH);
ctx.fillStyle = "rgba(12,24,22,.82)";
ctx.fillRect(d.innerX, d.vitalsY, d.innerW, 68 * VITALS_FIT * S);
ctx.fillStyle = "#7a2820"; ctx.fillRect(d.innerX + 8, d.vitalsY + 12 * VITALS_FIT * S, d.innerW - 60, 9 * VITALS_FIT * S);
ctx.fillStyle = "#4a3a7a"; ctx.fillRect(d.innerX + 8, d.vitalsY + 26 * VITALS_FIT * S, (d.innerW - 60) * 0.4, 9 * VITALS_FIT * S);
ctx.fillStyle = "#7a6330"; ctx.fillRect(d.innerX + 8, d.vitalsY + 40 * VITALS_FIT * S, (d.innerW - 60) * 0.7, 9 * VITALS_FIT * S);

// floating minimap, still over the map
const ms = 70 * S;
ctx.fillStyle = "#0f1a14"; ctx.fillRect(W - d.w - ms - 8 * S, 40 * S, ms, ms);

console.log(JSON.stringify(out));
