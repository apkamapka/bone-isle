/** Dev-only: a hotbar slot with a bound rune, at real size. */
import { slotCell, CHROME } from "../src/ui/chrome.ts";

interface R { x: number; y: number; w: number; h: number; c: string }
const out: R[] = [];
let cur = "#000";
let font = "";
const texts: { s: string; x: number; y: number; px: number }[] = [];
const ctx = {
  set fillStyle(v: string) { cur = v; },
  get fillStyle() { return cur; },
  set font(v: string) { font = v; },
  get font() { return font; },
  set textAlign(_v: string) { /* ignored */ },
  set textBaseline(_v: string) { /* ignored */ },
  set globalAlpha(_v: number) { /* ignored */ },
  get globalAlpha() { return 1; },
  fillRect(x: number, y: number, w: number, h: number) { out.push({ x, y, w, h, c: cur }); },
  fillText(s: string, x: number, y: number) {
    texts.push({ s, x, y, px: Number(/(\d+)px/.exec(font)?.[1] ?? 10) });
  },
} as unknown as CanvasRenderingContext2D;

// A 1600x900 laptop: scale 2.81, so a hotbar slot is 30 * 2.81 = 84px.
const S = Math.min(1600 / 480, 900 / 320);
const slot = Math.round(30 * S);
const gap = Math.round(4 * S);
["Life", "Frost", "Recall", "", "", ""].forEach((name, i) => {
  const x = 8 + i * (slot + gap);
  const usable = name !== "";
  slotCell(ctx, x, 8, slot, slot, S, {
    face: usable ? "rgba(46,58,54,.92)" : "rgba(24,26,30,.8)",
    accent: usable ? "#caa15a" : undefined,
  });
  if (usable) {
    // stand-in for the rune sprite: a square where itemSprite would go
    const box = slot * 0.44;
    ctx.fillStyle = ["#c0504a", "#5aa1e8", "#b08ad0"][i];
    ctx.fillRect(Math.round(x + (slot - box) / 2), Math.round(8 + slot * 0.10), Math.round(box), Math.round(box));
  }
});
console.error(`slot ${slot}px · icon box ${Math.round(slot * 0.44)}px · name ${Math.round(slot * 0.2)}px · sub ${Math.round(slot * 0.17)}px`);
console.log(JSON.stringify(out));
