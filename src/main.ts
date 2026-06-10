import "./style.css";
import { VIEW_W, VIEW_H, TILE, MAP_W, MAP_H } from "./config.ts";
import { makeWorld } from "./world/generate.ts";
import { moveEntity, portalSpawn } from "./world/collision.ts";
import { SPR } from "./gfx/sprites.ts";
import { clamp, dist } from "./util.ts";
import { createPlayer, playerSpeed } from "./entities/player.ts";
import { initInput, moveAxis, isDown } from "./input.ts";
import type { Vec } from "./world/types.ts";

/* ------------------------------------------------------------------
   Step 3: the player is back. WASD / arrows + click-to-move, sliding
   collision against terrain, trees and rocks, and a camera that follows.
   Monsters, combat, gathering and panels return in the next steps.
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

const player = createPlayer(portalSpawn(world));
const cam = { x: 0, y: 0 };
let moveMarker: { x: number; y: number; t: number } | null = null;

initInput(screen, {
  toWorld: (sx, sy): Vec => ({ x: sx / scale + cam.x, y: sy / scale + cam.y }),
  onClick: (w) => {
    player.dest = { x: w.x, y: w.y };
    moveMarker = { x: w.x, y: w.y, t: 0.8 };
  },
});

let waveT = 0;
let last = performance.now();

function update(dt: number): void {
  const spd = playerSpeed(player);

  // keyboard movement cancels a pending click destination
  const { dx, dy } = moveAxis();
  if (dx || dy) {
    player.dest = null;
    const l = Math.hypot(dx, dy);
    moveEntity(world, player, (dx / l) * spd * dt, (dy / l) * spd * dt);
    player.bob += dt * 10;
    if (dx) player.face = dx < 0 ? -1 : 1;
  }

  // click-to-move
  if (player.dest) {
    const d = dist(player.x, player.y, player.dest.x, player.dest.y);
    if (d < 3) {
      player.dest = null;
    } else {
      const vx = (player.dest.x - player.x) / d;
      const vy = (player.dest.y - player.y) / d;
      const ox = player.x;
      const oy = player.y;
      moveEntity(world, player, vx * spd * dt, vy * spd * dt);
      if (Math.abs(player.x - ox) < 0.01 && Math.abs(player.y - oy) < 0.01) player.dest = null;
      player.bob += dt * 10;
      if (vx) player.face = vx < 0 ? -1 : 1;
    }
  }

  if (moveMarker) {
    moveMarker.t -= dt;
    if (moveMarker.t <= 0) moveMarker = null;
  }

  // camera follows the player, clamped to map bounds
  cam.x = clamp(player.x - VIEW_W / 2, 0, MAP_W * TILE - VIEW_W);
  cam.y = clamp(player.y - VIEW_H / 2, 0, MAP_H * TILE - VIEW_H);
}

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

function drawShadow(x: number, y: number, w: number): void {
  vctx.fillStyle = "rgba(0,0,0,.22)";
  vctx.fillRect(Math.floor(x - w / 2 - cam.x), Math.floor(y - 1 - cam.y), w, 3);
}

function drawPlayer(): void {
  drawShadow(player.x, player.y, 9);
  const moving = player.dest !== null || isDown("w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright");
  const bob = moving && Math.sin(player.bob) > 0 ? -1 : 0;
  const x = Math.floor(player.x - 5 - cam.x);
  const y = Math.floor(player.y - 13 - cam.y) + bob;
  vctx.drawImage(player.spr, x, y);
  if (player.face >= 0) {
    vctx.drawImage(SPR.sword, x + 10, y + 5);
  } else {
    vctx.save();
    vctx.translate(x, y + 5);
    vctx.scale(-1, 1);
    vctx.drawImage(SPR.sword, 1, 0);
    vctx.restore();
  }
  // HP bar above head
  const bx = Math.floor(player.x - 8 - cam.x);
  const by = Math.floor(player.y - 17 - cam.y);
  vctx.fillStyle = "#000";
  vctx.fillRect(bx - 1, by - 1, 18, 4);
  const f = clamp(player.hp / player.maxhp, 0, 1);
  vctx.fillStyle = f > 0.6 ? "#46d35b" : f > 0.3 ? "#e3b341" : "#e1483b";
  vctx.fillRect(bx, by, Math.round(16 * f), 2);
}

interface Drawable {
  y: number;
  draw: () => void;
}

function render(): void {
  vctx.drawImage(world.mapCanvas, -Math.floor(cam.x), -Math.floor(cam.y));

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

  if (moveMarker) {
    const x = Math.floor(moveMarker.x - cam.x);
    const y = Math.floor(moveMarker.y - cam.y);
    vctx.globalAlpha = moveMarker.t;
    vctx.fillStyle = "#ffe27a";
    vctx.fillRect(x - 3, y, 7, 1);
    vctx.fillRect(x, y - 3, 1, 7);
    vctx.globalAlpha = 1;
  }

  // y-sorted: trees, rocks, player
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
  draws.push({ y: player.y, draw: drawPlayer });
  draws.sort((a, b) => a.y - b.y);
  for (const d of draws) d.draw();

  // banner
  vctx.font = "bold 8px monospace";
  vctx.textAlign = "left";
  vctx.fillStyle = "rgba(0,0,0,.6)";
  vctx.fillText(`${world.name} · WASD / click to move`, 9, 15);
  vctx.fillStyle = "#cfe8d2";
  vctx.fillText(`${world.name} · WASD / click to move`, 8, 14);

  sctx.imageSmoothingEnabled = false;
  sctx.drawImage(view, 0, 0, VIEW_W * scale, VIEW_H * scale);
}

function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  waveT += dt;
  update(dt);
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
