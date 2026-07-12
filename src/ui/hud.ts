/** Screen-space HUD: HP/EXP bars, cap, gold, minimap, action bar, overlays. */
import { TILE } from "../config.ts";
import { SPR, itemSprite } from "../gfx/sprites.ts";
import { clamp } from "../util.ts";
import { actionSlots } from "../systems/actions.ts";
import { bagCount } from "../items.ts";
import { carryCap, carriedWeight } from "../entities/player.ts";
import type { Player } from "../entities/player.ts";
import type { Game } from "../game.ts";

export interface HudCtx {
  ctx: CanvasRenderingContext2D;
  scale: number;
  screenW: number;
  screenH: number;
  touch?: boolean;
}

function panel(h: HudCtx, x: number, y: number, w: number, ph: number): void {
  const { ctx, scale: S } = h;
  ctx.fillStyle = "rgba(12,24,22,.78)";
  ctx.fillRect(x, y, w, ph);
  ctx.strokeStyle = "#3d5a50";
  ctx.lineWidth = S;
  ctx.strokeRect(x + S / 2, y + S / 2, w - S, ph - S);
}

function bar(h: HudCtx, x: number, y: number, w: number, ph: number, frac: number, fg: string, bg: string): void {
  const { ctx, scale: S } = h;
  ctx.fillStyle = "#000";
  ctx.fillRect(x - S, y - S, w + 2 * S, ph + 2 * S);
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, ph);
  ctx.fillStyle = fg;
  ctx.fillRect(x, y, Math.round(w * clamp(frac, 0, 1)), ph);
  ctx.fillStyle = "rgba(255,255,255,.18)";
  ctx.fillRect(x, y, Math.round(w * clamp(frac, 0, 1)), Math.ceil(ph / 3));
}

export function hudText(
  h: HudCtx,
  str: string,
  x: number,
  y: number,
  size: number,
  color: string,
  align: CanvasTextAlign = "left",
  bold = false,
): void {
  const { ctx, scale: S } = h;
  ctx.font = `${bold ? "bold " : ""}${Math.round(size)}px 'Courier New',monospace`;
  ctx.textAlign = align;
  ctx.fillStyle = "rgba(0,0,0,.7)";
  ctx.fillText(str, x + S, y + S);
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

/** Small minimap of the current island in the top-right corner. */
function drawMinimap(h: HudCtx, game: Game, p: Player): void {
  const { ctx, scale: S, screenW } = h;
  const w = game.current;
  const size = 70 * S;
  const x = screenW - size - 8 * S;
  const y = 40 * S;
  const sx = size / (w.w * TILE);
  const sy = size / (w.h * TILE);
  ctx.fillStyle = "rgba(6,14,13,.85)";
  ctx.fillRect(x - 2 * S, y - 2 * S, size + 4 * S, size + 4 * S);
  ctx.strokeStyle = "#3d5a50";
  ctx.lineWidth = S;
  ctx.strokeRect(x - 2 * S + S / 2, y - 2 * S + S / 2, size + 4 * S - S, size + 4 * S - S);
  // terrain: sample tiles coarsely
  const step = 2;
  for (let ty = 0; ty < w.h; ty += step) {
    for (let tx = 0; tx < w.w; tx += step) {
      const t = w.tile[ty][tx];
      ctx.fillStyle = t === 0 ? "#1c6060" : t === 2 ? "#c8b47a" : t === 3 ? "#6b7275" : "#557a34";
      ctx.fillRect(x + tx * TILE * sx, y + ty * TILE * sy, Math.max(1, step * TILE * sx), Math.max(1, step * TILE * sy));
    }
  }
  // portals
  for (const pt of w.portals) {
    ctx.fillStyle = "#7fd0ff";
    ctx.fillRect(x + pt.x * sx - 1, y + pt.y * sy - 1, 3, 3);
  }
  // monsters
  ctx.fillStyle = "#e05a4a";
  for (const m of w.monsters) ctx.fillRect(x + m.x * sx - 1, y + m.y * sy - 1, 2, 2);
  // player
  ctx.fillStyle = "#ffe9a8";
  ctx.fillRect(x + p.x * sx - 1.5, y + p.y * sy - 1.5, 3, 3);
}

export function drawHud(h: HudCtx, game: Game, p: Player): void {
  const { ctx, scale: S, screenW, screenH } = h;
  const pad = 8 * S;
  ctx.textBaseline = "middle";

  // bottom-left: HP + EXP + Cap
  const pw = 190 * S;
  const ph = 54 * S;
  const px = pad;
  const py = screenH - ph - pad;
  panel(h, px, py, pw, ph);
  bar(h, px + 10 * S, py + 8 * S, 130 * S, 8 * S, p.hp / p.maxhp, "#e1483b", "#5d1a14");
  hudText(h, `HP ${Math.ceil(p.hp)}/${p.maxhp}`, px + 145 * S, py + 11 * S + 1, 8 * S, "#ffd9d4");
  bar(h, px + 10 * S, py + 22 * S, 130 * S, 8 * S, p.exp / p.expNext, "#b07fe8", "#3c2752");
  hudText(h, `Lv ${p.level}`, px + 145 * S, py + 25 * S + 1, 8 * S, "#e6d4ff");
  const cap = carryCap(p);
  const used = Math.round(carriedWeight(p));
  const capFull = used >= cap;
  hudText(h, "Cap", px + 10 * S, py + 40 * S, 8 * S, "rgba(220,214,190,.7)");
  bar(h, px + 34 * S, py + 37 * S, 106 * S, 6 * S, used / cap, capFull ? "#e06a4a" : "#caa15a", "#3a3222");
  hudText(h, `${used}/${cap}`, px + 145 * S, py + 40 * S, 8 * S, capFull ? "#ffb59a" : "#e8dcc0");

  // top-right: gold (box auto-sizes so big amounts always fit the frame)
  const cd = SPR.coin;
  const cdw = cd.width * 2 * S;
  const cdh = cd.height * 2 * S;
  const goldStr = `${p.gold}`;
  ctx.font = `bold ${9 * S}px monospace`;
  const goldW = ctx.measureText(goldStr).width;
  ctx.font = `${8 * S}px monospace`;
  const labelW = ctx.measureText("gold").width;
  const iw = Math.max(150 * S, 9 * S + cdw + 6 * S + goldW + 8 * S + labelW + 10 * S);
  const ih = 22 * S;
  const ix = screenW - iw - pad;
  const iy = pad;
  panel(h, ix, iy, iw, ih);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(cd, ix + 9 * S, iy + (ih - cdh) / 2, cdw, cdh);
  hudText(h, goldStr, ix + 9 * S + cdw + 6 * S, iy + ih / 2, 9 * S, "#f3eedd", "left", true);
  hudText(h, "gold", ix + iw - 8 * S, iy + ih / 2, 8 * S, "rgba(220,214,190,.6)", "right");

  // top-left: title + zone
  hudText(h, "BONE ISLE", pad + 2, pad + 7 * S, 11 * S, "#cfe8d2", "left", true);
  hudText(h, game.current.name + (game.current.safe ? " · safe" : " · danger"), pad + 2, pad + 18 * S, 8 * S, "rgba(207,232,210,.7)");

  drawMinimap(h, game, p);

  // action bar (bottom-center) — desktop only; touch uses on-screen buttons
  if (!h.touch) {
    const bw = 34 * S;
    const gap = 6 * S;
    const n = actionSlots.length;
    let sx = screenW / 2 - (n * bw + (n - 1) * gap) / 2;
    const sy = screenH - pad - 22 * S;
    for (let i = 0; i < n; i++) {
      const slot = actionSlots[i];
      const item = slot && slot.type === "crystal" ? slot.item : null;
      const charges = item ? bagCount(p.bag, item) : 0;
      const usable = item != null && charges > 0;
      ctx.fillStyle = slot ? "rgba(30,40,50,.85)" : "rgba(24,24,24,.6)";
      ctx.fillRect(sx, sy, bw, bw);
      ctx.strokeStyle = usable ? "#caa15a" : "#455";
      ctx.lineWidth = S;
      ctx.strokeRect(sx + S / 2, sy + S / 2, bw - S, bw - S);
      hudText(h, `${i + 1}`, sx + 3 * S, sy + 6 * S, 7 * S, "rgba(220,214,190,.6)");
      if (item) {
        const spr = itemSprite(item);
        const isc = 2 * S;
        ctx.imageSmoothingEnabled = false;
        ctx.globalAlpha = usable ? 1 : 0.35;
        ctx.drawImage(spr, sx + (bw - spr.width * isc) / 2, sy + (bw - spr.height * isc) / 2 - S, spr.width * isc, spr.height * isc);
        ctx.globalAlpha = 1;
        hudText(h, `${charges}`, sx + bw - 3 * S, sy + bw - 4 * S, 7 * S, usable ? "#ffe9a8" : "#c86", "right");
      }
      sx += bw + gap;
    }
    hudText(h, "1 Life · 2 Fire · 3 Recall", screenW / 2, sy - 6 * S, 7 * S, "rgba(220,214,190,.5)", "center");
  }

  // zone flash
  if (game.zoneFlash.t > 0) {
    ctx.globalAlpha = clamp(game.zoneFlash.t, 0, 1);
    hudText(h, game.zoneFlash.text, screenW / 2, 40 * S, 16 * S, "#ffe9a8", "center", true);
    ctx.globalAlpha = 1;
  }

  // death overlay
  if (p.dead) {
    ctx.fillStyle = "rgba(20,10,10,.45)";
    ctx.fillRect(0, 0, screenW, screenH);
    hudText(h, "You died", screenW / 2, screenH / 2 - 8 * S, 22 * S, "#ff6a5e", "center", true);
    hudText(h, `respawning at Home Isle in ${Math.ceil(p.deadT)}...`, screenW / 2, screenH / 2 + 12 * S, 10 * S, "#f3eedd", "center");
  }
}
