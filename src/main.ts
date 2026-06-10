import "./style.css";
import { VIEW_W, VIEW_H, TILE, MAP_W, MAP_H } from "./config.ts";
import { makeWorld } from "./world/generate.ts";
import { SPR } from "./gfx/sprites.ts";
import { clamp } from "./util.ts";

/* ------------------------------------------------------------------
   Step 2: the world generator is live. We render a real Home Isle —
   terrain, trees, rocks, animated coast + portal — with a camera that
   slowly pans. Player and controls arrive in step 3.
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

const world = makeWorld({
  name: "Home Isle",
  safe: true,
  buildSpots: true,
  trees: 5,
  rocks: 4,
  mushrooms: 6,
  bones: 3,
});

const cam = { x: 0, y: 0 };
const MAP_PX_W = MAP_W * TILE;
const MAP_PX_H = MAP_H * TILE;

let waveT = 0;
let last = performance.now();

function drawPortal(): void {
  const px = world.portal.x - cam.x;
  const py = world.portal.y - cam.y;
  const pulse = 0.25 + 0.18 * Math.sin(waveT * 2.4);
  vctx.globalAlpha = pulse;
  vctx.fillStyle = "#7be0d2";
  vctx.beginPath();
  vctx.ellipse(px, py, 9, 5, 0, 0, 6.283);
  vctx.fill();
  vctx.globalAlpha = pulse * 0.7;
  vctx.fillStyle = "#c08bf0";
  vctx.beginPath();
  vctx.ellipse(px, py, 5, 3, 0, 0, 6.283);
  vctx.fill();
  vctx.globalAlpha = 1;
  for (let i = 0; i < 8; i++) {
    const th = waveT * 1.8 + i * 0.785;
    const sx = px + Math.cos(th) * 10;
    const sy = py + Math.sin(th) * 5.5 - Math.sin(waveT * 3 + i) * 1.5;
    vctx.fillStyle = i % 2 ? "#8be8dc" : "#d2a8ff";
    vctx.fillRect(Math.floor(sx), Math.floor(sy), 2, 2);
  }
}

interface Drawable {
  y: number;
  draw: () => void;
}

function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  waveT += dt;

  // slow circular camera pan to show the whole island
  const cx = (MAP_PX_W - VIEW_W) / 2;
  const cy = (MAP_PX_H - VIEW_H) / 2;
  cam.x = clamp(cx + Math.cos(waveT * 0.15) * cx, 0, MAP_PX_W - VIEW_W);
  cam.y = clamp(cy + Math.sin(waveT * 0.15) * cy, 0, MAP_PX_H - VIEW_H);

  vctx.drawImage(world.mapCanvas, -Math.floor(cam.x), -Math.floor(cam.y));

  // animated coastal waves
  vctx.fillStyle = "rgba(170,225,212,.6)";
  for (const wv of world.coastWater) {
    const sx = wv.x - cam.x;
    const sy = wv.y - cam.y;
    if (sx < -TILE || sy < -TILE || sx > VIEW_W || sy > VIEW_H) continue;
    const ph = Math.sin(waveT * 1.6 + wv.ph);
    if (ph > 0.2) vctx.fillRect(Math.floor(sx + 4 + ph * 4), Math.floor(sy + 6), 5, 1);
    if (ph < -0.4) vctx.fillRect(Math.floor(sx + 2 - ph * 3), Math.floor(sy + 11), 4, 1);
  }

  drawPortal();

  // build pads: glowing outlines
  for (const s of world.buildSpots) {
    if (s.built) continue;
    const x = Math.floor(s.tx * TILE - cam.x);
    const y = Math.floor(s.ty * TILE - cam.y);
    vctx.globalAlpha = 0.35 + 0.3 * Math.sin(waveT * 3 + s.tx);
    vctx.strokeStyle = "#e3b341";
    vctx.lineWidth = 1;
    vctx.strokeRect(x + 0.5, y + 0.5, 31, 31);
    vctx.fillStyle = "#e3b341";
    for (const [ox, oy] of [[0, 0], [29, 0], [0, 29], [29, 29]] as const)
      vctx.fillRect(x + ox, y + oy, 3, 3);
    vctx.globalAlpha = 1;
  }

  // y-sorted trees & rocks
  const draws: Drawable[] = [];
  for (const tr of world.trees) {
    draws.push({
      y: tr.ty * TILE + TILE,
      draw: () => {
        const x = tr.tx * TILE - cam.x;
        const y = tr.ty * TILE + TILE - 26 - cam.y;
        vctx.fillStyle = "rgba(0,0,0,.2)";
        vctx.fillRect(Math.floor(tr.tx * TILE + 2 - cam.x), Math.floor(tr.ty * TILE + TILE - 4 - cam.y), 12, 3);
        vctx.drawImage(tr.spr, Math.floor(x), Math.floor(y));
      },
    });
  }
  for (const rk of world.rocks) {
    draws.push({
      y: rk.ty * TILE + TILE - 2,
      draw: () => {
        vctx.drawImage(SPR.rock, Math.floor(rk.tx * TILE + 3 - cam.x), Math.floor(rk.ty * TILE + TILE - 8 - cam.y));
      },
    });
  }
  draws.sort((a, b) => a.y - b.y);
  for (const d of draws) d.draw();

  // banner
  vctx.font = "bold 8px monospace";
  vctx.textAlign = "left";
  vctx.fillStyle = "rgba(0,0,0,.6)";
  vctx.fillText(`${world.name} · world generator OK`, 9, 15);
  vctx.fillStyle = "#cfe8d2";
  vctx.fillText(`${world.name} · world generator OK`, 8, 14);

  sctx.imageSmoothingEnabled = false;
  sctx.drawImage(view, 0, 0, VIEW_W * scale, VIEW_H * scale);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
