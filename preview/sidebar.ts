/** Dev-only: lay out the sidebar with the real dock maths and dump rects. */
import { dockLayout, dockScale, VITALS_FIT, GOLD_ROW_H, BLOCK_BAR, BTN_ROW_H, SLOT_ROW_H, SWAP_H } from "../src/ui/dock.ts";
import { panelFrame, raisedBox, buttonBox, slotCell, CHROME, frameInset } from "../src/ui/chrome.ts";

interface Rect { x: number; y: number; w: number; h: number; c: string }
const out: Rect[] = [];
let cur = "#000";
const ctx = {
  set fillStyle(v: string) { cur = v; },
  get fillStyle() { return cur; },
  fillRect(x: number, y: number, w: number, h: number) { out.push({ x, y, w, h, c: cur }); },
} as unknown as CanvasRenderingContext2D;

// Radek's display: 1920x917 CSS at dpr 1.
const W = 1920, H = 917, dpr = 1;
const hudScale = Math.min(W / 480, H / 320);
const S = dockScale(hudScale, dpr);
const d = dockLayout(W, H, S, true);

ctx.fillStyle = "#56803e"; ctx.fillRect(0, 0, W - d.w, H);
ctx.fillStyle = "rgba(10,8,5,.94)"; ctx.fillRect(d.x, 0, d.w, H);
ctx.fillStyle = CHROME.panelEdge; ctx.fillRect(d.x, 0, Math.round(S), H);

const bar = Math.round(BLOCK_BAR * S);
const gap = Math.round(4 * S);
for (const b of ["minimap", "status", "controls"] as const) {
  const r = d.blocks[b];
  raisedBox(ctx, d.innerX, r.y, d.innerW, bar, CHROME.barFace, CHROME.barLight, CHROME.barDark, S);
  if (r.collapsed) continue;
  if (b === "minimap") {
    slotCell(ctx, d.innerX, r.bodyY, d.innerW, Math.min(d.innerW, r.bodyH), S, { face: "#0f1a14" });
  } else if (b === "status") {
    const gh = Math.round(GOLD_ROW_H * S);
    raisedBox(ctx, d.innerX, r.bodyY, d.innerW, gh, "rgba(12,24,22,.82)", "#4e7268", "#08110f", S);
    const vy = r.bodyY + gh + gap;
    raisedBox(ctx, d.innerX, vy, d.innerW, Math.round(68 * VITALS_FIT * S), "rgba(12,24,22,.82)", "#4e7268", "#08110f", S);
    const bw = d.innerW - 50 * VITALS_FIT * S;
    ctx.fillStyle = "#7a2820"; ctx.fillRect(d.innerX + 6, vy + 12 * VITALS_FIT * S, bw, 9 * VITALS_FIT * S);
    ctx.fillStyle = "#4a3a7a"; ctx.fillRect(d.innerX + 6, vy + 26 * VITALS_FIT * S, bw * 0.4, 9 * VITALS_FIT * S);
    ctx.fillStyle = "#7a6330"; ctx.fillRect(d.innerX + 6, vy + 40 * VITALS_FIT * S, bw * 0.7, 9 * VITALS_FIT * S);
  } else {
    const bh = Math.round(BTN_ROW_H * S);
    const bw = (d.innerW - gap * 4) / 5;
    for (let i = 0; i < 5; i++) {
      buttonBox(ctx, d.innerX + i * (bw + gap), r.bodyY, bw, bh, S,
        { on: i === 3, face: i === 3 ? "rgba(202,162,58,.92)" : undefined });
    }
    const sy = r.bodyY + bh + gap;
    const sh = Math.round(SLOT_ROW_H * S);
    const sw = (d.innerW - gap * 5) / 6;
    for (let i = 0; i < 6; i++) slotCell(ctx, d.innerX + i * (sw + gap), sy, sw, sh, S, { face: "rgba(46,58,54,.92)" });
    buttonBox(ctx, d.innerX, sy + sh + gap, d.innerW, Math.round(SWAP_H * S), S, {});
  }
}

// containers stacking below the fixed blocks, at FULL size
let y = d.stackTop;
for (let n = 0; n < 3; n++) {
  const cell = 32 * S, cg = 4 * S, rows = 4;
  const h = 20 * S + rows * cell + (rows - 1) * cg + 20 * S;
  if (y + h > d.stackBottom) break;
  panelFrame(ctx, d.innerX, y, d.innerW, h, S);
  raisedBox(ctx, d.innerX + frameInset(S), y + frameInset(S), d.innerW - 2 * frameInset(S),
    14 * S - frameInset(S), CHROME.barFace, CHROME.barLight, CHROME.barDark, S);
  const gw = 4 * cell + 3 * cg;
  const gx = d.innerX + (d.innerW - gw) / 2;
  for (let i = 0; i < 16; i++) {
    slotCell(ctx, gx + (i % 4) * (cell + cg), y + 20 * S + Math.floor(i / 4) * (cell + cg), cell, cell, S,
      { accent: i < 5 ? CHROME.slotFilled : undefined });
  }
  y += h + 4 * S;
}
console.error(`dock unit ${S.toFixed(2)} | column ${d.w}px (${(d.w / W * 100).toFixed(1)}%) | stack ${d.stackTop}..${d.stackBottom} | containers fitted ${Math.floor((d.stackBottom - d.stackTop) / (180 * S + 4 * S))}`);
console.log(JSON.stringify(out));
