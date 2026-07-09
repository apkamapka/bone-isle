/** Screen-space HUD: HP/mana/EXP bars, gold, minimap, spells, overlays. */
import { TILE } from "../config.ts";
import { SPR } from "../gfx/sprites.ts";
import { clamp } from "../util.ts";
import { SPELLS, spellsUnlocked } from "../systems/magic.ts";
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

  // bottom-left: HP + mana + EXP
  const pw = 190 * S;
  const ph = 56 * S;
  const px = pad;
  const py = screenH - ph - pad;
  panel(h, px, py, pw, ph);
  bar(h, px + 10 * S, py + 8 * S, 130 * S, 8 * S, p.hp / p.maxhp, "#e1483b", "#5d1a14");
  hudText(h, `HP ${Math.ceil(p.hp)}/${p.maxhp}`, px + 145 * S, py + 11 * S + 1, 8 * S, "#ffd9d4");
  bar(h, px + 10 * S, py + 22 * S, 130 * S, 8 * S, p.mana / p.maxmana, "#4f8ff0", "#182a52");
  hudText(h, `MP ${Math.ceil(p.mana)}/${p.maxmana}`, px + 145 * S, py + 25 * S + 1, 8 * S, "#cfe0ff");
  bar(h, px + 10 * S, py + 36 * S, 130 * S, 8 * S, p.exp / p.expNext, "#b07fe8", "#3c2752");
  hudText(h, `Lv ${p.level}`, px + 145 * S, py + 39 * S + 1, 8 * S, "#e6d4ff");

  // top-right: gold + resource counts
  const iw = 150 * S;
  const ih = 22 * S;
  const ix = screenW - iw - pad;
  const iy = pad;
  panel(h, ix, iy, iw, ih);
  ctx.imageSmoothingEnabled = false;
  const cd = SPR.coin;
  const cdw = cd.width * 2 * S;
  const cdh = cd.height * 2 * S;
  ctx.drawImage(cd, ix + 9 * S, iy + (ih - cdh) / 2, cdw, cdh);
  hudText(h, `${p.gold}`, ix + 9 * S + cdw + 4 * S, iy + ih / 2, 9 * S, "#f3eedd", "left", true);
  hudText(h, "gold", ix + iw - 8 * S, iy + ih / 2, 8 * S, "rgba(220,214,190,.6)", "right");

  // top-left: title + zone
  hudText(h, "BONE ISLE", pad + 2, pad + 7 * S, 11 * S, "#cfe8d2", "left", true);
  hudText(h, game.current.name + (game.current.safe ? " · safe" : " · danger"), pad + 2, pad + 18 * S, 8 * S, "rgba(207,232,210,.7)");

  drawMinimap(h, game, p);

  // spell bar / hotkey hint (bottom-center) — desktop only; touch uses buttons
  if (!h.touch) {
    if (spellsUnlocked(game.current) || spellsUnlocked(game.worlds.home)) {
      const bw = 58 * S;
      const step = 62 * S;
      let sx = screenW / 2 - (SPELLS.length * step - (step - bw)) / 2;
      const sy = screenH - pad - 20 * S;
      SPELLS.forEach((sp, i) => {
        const enough = p.mana >= sp.cost;
        ctx.fillStyle = enough ? "rgba(40,60,90,.85)" : "rgba(40,40,40,.7)";
        ctx.fillRect(sx, sy, bw, 16 * S);
        ctx.strokeStyle = enough ? "#4f8ff0" : "#555";
        ctx.lineWidth = S;
        ctx.strokeRect(sx + S / 2, sy + S / 2, bw - S, 16 * S - S);
        hudText(h, `${i + 1} ${sp.name}`, sx + 4 * S, sy + 8 * S, 7 * S, enough ? "#dfe8ff" : "#888");
        sx += step;
      });
    } else {
      hudText(h, "[B]uild [S]kills [E]quip [I]nv [Q]uests · click a Chest to stash", screenW / 2, screenH - pad - 5 * S, 8 * S, "#e3d9b8", "center", true);
    }
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
