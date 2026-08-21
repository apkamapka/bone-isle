/** Emit the landscape deck's real geometry as coloured rects. */
import { mobileLayout, DECK_TABS } from "../src/ui/mobile.ts";
const W = Number(process.argv[2] ?? 915), H = Number(process.argv[3] ?? 412), DPR = 2;
const d = mobileLayout(W * DPR, H * DPR, DPR, 0, 0);
const out: { x: number; y: number; w: number; h: number; c: string; t?: string }[] = [];
const push = (r: { x: number; y: number; w: number; h: number }, c: string, t?: string): void => { out.push({ ...r, c, t }); };
push({ x: 0, y: 0, w: W * DPR, h: d.topH }, "#0a0805");
push({ x: 0, y: d.topH, w: d.mapLeft, h: H * DPR - d.topH }, "#0a0805");
push({ x: d.mapRight, y: d.topH, w: W * DPR - d.mapRight, h: H * DPR - d.topH }, "#0a0805");
push(d.info, "#1b3330", "zone");
push(d.vitals, "#2a1a18", "hp | cap");
push(d.purse, "#3a3222", "gold TP");
d.slots.forEach((r, i) => push(r, "#3a4a44", `${i + 1}`));
push(d.minimap, "#12241c", "map");
push(d.swap, "#26302e", "swap");
push(d.menu, "#3a3020", "menu");
push(d.edit, "#26302e", "edit");
if (process.argv[4] === "menu") d.tabs.forEach((r, i) => push(r, "#2e3a36", DECK_TABS[i]));
console.log(JSON.stringify({ w: W * DPR, h: H * DPR, rects: out }));
