import "./style.css";
import { VIEW_W, VIEW_H, TILE } from "./config.ts";
import {
  SPR, bakeTree, bakeForge, bakeLibrary, bakeGarden, bakeDummy,
} from "./gfx/sprites.ts";

/* ------------------------------------------------------------------
   Bootstrap: low-res buffer + integer-scaled on-screen canvas.
   This file is temporary "sprite showcase" — it proves config + sprites
   work under Vite/TS before we port the world generator and entities.
   ------------------------------------------------------------------ */

const screen = document.createElement("canvas");
screen.style.imageRendering = "pixelated";
document.body.appendChild(screen);
const sctx = screen.getContext("2d")!;

const view = document.createElement("canvas");
view.width = VIEW_W;
view.height = VIEW_H;
const vctx = view.getContext("2d")!;

let scale = 2;
function resize(): void {
  scale = Math.max(1, Math.floor(Math.min(innerWidth / VIEW_W, innerHeight / VIEW_H)));
  screen.width = VIEW_W * scale;
  screen.height = VIEW_H * scale;
  sctx.imageSmoothingEnabled = false;
}
addEventListener("resize", resize);
resize();

/* ---- showcase content ---- */

const trees = [bakeTree(), bakeTree(), bakeTree()];
const structures = [
  { spr: bakeForge(), label: "Forge" },
  { spr: bakeLibrary(), label: "Library" },
  { spr: bakeGarden(), label: "Garden" },
  { spr: bakeDummy(), label: "Dummy" },
];

interface Item { spr: HTMLCanvasElement; label: string }
const cast: Item[] = [
  { spr: SPR.player, label: "Player" },
  { spr: SPR.skeleton, label: "Skeleton" },
  { spr: SPR.goblin, label: "Goblin" },
  { spr: SPR.bones, label: "Bones" },
  { spr: SPR.coin, label: "Coin" },
  { spr: SPR.wood, label: "Wood" },
  { spr: SPR.stoneIcon, label: "Stone" },
  { spr: SPR.rock, label: "Rock" },
  { spr: SPR.mushroom, label: "Shroom" },
];

let t = 0;
let last = performance.now();

function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  t += dt;

  // backdrop: teal water + grass island band
  vctx.fillStyle = "#2e8f8a";
  vctx.fillRect(0, 0, VIEW_W, VIEW_H);
  vctx.fillStyle = "#d9c47a";
  vctx.fillRect(20, 40, VIEW_W - 40, VIEW_H - 80);
  vctx.fillStyle = "#6f9a44";
  vctx.fillRect(28, 48, VIEW_W - 56, VIEW_H - 96);

  vctx.font = "bold 8px monospace";
  vctx.textAlign = "center";
  vctx.fillStyle = "#1c1410";
  vctx.fillText("BONE ISLE — sprite pipeline OK", VIEW_W / 2, 20);

  // entity row (player bobs to prove the RAF loop runs)
  cast.forEach((item, i) => {
    const x = 50 + i * 44;
    const bob = item.label === "Player" && Math.sin(t * 6) > 0 ? -1 : 0;
    const y = 90 - item.spr.height + bob;
    vctx.drawImage(item.spr, x - (item.spr.width >> 1), y);
    vctx.fillStyle = "#1c1410";
    vctx.fillText(item.label, x, 102);
  });

  // trees
  trees.forEach((tr, i) => vctx.drawImage(tr, 60 + i * 30, 120));
  vctx.fillStyle = "#1c1410";
  vctx.fillText("Trees (unique each bake)", 105, 160);

  // structures with forge ember flicker
  structures.forEach((s, i) => {
    const x = 220 + i * 56;
    const y = 150 - s.spr.height + 26;
    vctx.drawImage(s.spr, x, y);
    if (s.label === "Forge") {
      vctx.globalAlpha = 0.4 + 0.4 * Math.abs(Math.sin(t * 7));
      vctx.fillStyle = "#ff9b3e";
      vctx.fillRect(x + 10, y + 19, 7, 4);
      vctx.globalAlpha = 1;
    }
    vctx.fillText(s.label, x + (s.spr.width >> 1), 162);
  });

  // tile-grid sanity check
  for (let i = 0; i < 6; i++) {
    vctx.strokeStyle = "rgba(0,0,0,.25)";
    vctx.strokeRect(60.5 + i * TILE, 200.5, TILE, TILE);
  }
  vctx.fillStyle = "#1c1410";
  vctx.fillText(`TILE = ${TILE}px`, 110, 232);

  sctx.imageSmoothingEnabled = false;
  sctx.drawImage(view, 0, 0, VIEW_W * scale, VIEW_H * scale);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
