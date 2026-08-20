/** Emit the portrait deck's real geometry as coloured rects, for rasterisation. */
import { mobileLayout, sheetSlots, DECK_TABS } from "../src/ui/mobile.ts";

const CSS_W = Number(process.argv[2] ?? 412);
const CSS_H = Number(process.argv[3] ?? 915);
const DPR = Number(process.argv[4] ?? 2);
const d = mobileLayout(CSS_W * DPR, CSS_H * DPR, DPR, 0, 24 * DPR);

const out: { x: number; y: number; w: number; h: number; c: string; t?: string }[] = [];
const push = (r: { x: number; y: number; w: number; h: number }, c: string, t?: string): void => {
  out.push({ ...r, c, t });
};

push({ x: 0, y: 0, w: CSS_W * DPR, h: d.topH }, "#0a0805");
push({ x: 0, y: d.deckY, w: CSS_W * DPR, h: CSS_H * DPR - d.deckY }, "#0a0805");
push(d.info, "#1b3330", "zone");
push(d.purse, "#3a3222", "gold/TP");
push(d.vitals, "#2a1a18", "hp/cap");
push(d.menu, "#3a3020", "\u2261");
push(d.edit, "#26302e", "edit");
push(d.swap, "#26302e", "swap");
push(d.minimap, "#12241c", "map");
if (process.argv[5] === "menu") d.tabs.forEach((r, i) => push(r, "#2e3a36", DECK_TABS[i]));
d.slots.forEach((r, i) => push(r, "#3a4a44", `${i + 1}`));
const n = Number(process.argv[6] ?? 1);
sheetSlots(d, n).forEach((r, i) => push(r, "#5a4718", `panel ${i + 1}`));

console.log(JSON.stringify({
  w: CSS_W * DPR, h: CSS_H * DPR, u: d.u, mapTop: d.mapTop, mapBottom: d.mapBottom, rects: out,
}));
