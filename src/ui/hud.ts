/** Screen-space HUD: HP/EXP bars, inventory, shortcut hints, overlays. */
import { SPR } from "../gfx/sprites.ts";
import { clamp } from "../util.ts";
import type { Player } from "../entities/player.ts";
import type { Game } from "../game.ts";

export interface HudCtx {
  ctx: CanvasRenderingContext2D;
  scale: number;
  screenW: number;
  screenH: number;
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

export function drawHud(h: HudCtx, game: Game, p: Player): void {
  const { ctx, scale: S, screenW, screenH } = h;
  const pad = 8 * S;
  ctx.textBaseline = "middle";

  // bottom-left: HP + EXP
  const pw = 190 * S;
  const ph = 44 * S;
  const px = pad;
  const py = screenH - ph - pad;
  panel(h, px, py, pw, ph);
  bar(h, px + 10 * S, py + 8 * S, 130 * S, 9 * S, p.hp / p.maxhp, "#e1483b", "#5d1a14");
  hudText(h, `HP ${Math.ceil(p.hp)}/${p.maxhp}`, px + 145 * S, py + 12 * S + 1, 9 * S, "#ffd9d4");
  bar(h, px + 10 * S, py + 25 * S, 130 * S, 9 * S, p.exp / p.expNext, "#b07fe8", "#3c2752");
  hudText(h, `Lv ${p.level}`, px + 145 * S, py + 29 * S + 1, 9 * S, "#e6d4ff");

  // top-right: inventory
  const iw = 212 * S;
  const ih = 24 * S;
  const ix = screenW - iw - pad;
  const iy = pad;
  panel(h, ix, iy, iw, ih);
  ctx.imageSmoothingEnabled = false;
  const entries: ReadonlyArray<readonly [HTMLCanvasElement, number]> = [
    [SPR.wood, p.inv.wood], [SPR.stoneIcon, p.inv.stone], [SPR.bones, p.inv.bones], [SPR.coin, p.inv.coins],
  ];
  let ex = ix + 9 * S;
  for (const [spr, n] of entries) {
    const dw = spr.width * 2 * S;
    const dh = spr.height * 2 * S;
    ctx.drawImage(spr, ex, iy + (ih - dh) / 2, dw, dh);
    hudText(h, `x${n}`, ex + dw + 3 * S, iy + ih / 2, 9 * S, "#f3eedd");
    ex += dw + 3 * S + 30 * S;
  }

  // top-left: title + zone
  hudText(h, "BONE ISLE", pad + 2, pad + 7 * S, 11 * S, "#cfe8d2", "left", true);
  hudText(h, game.current.name + (game.current.safe ? " · safe" : ""), pad + 2, pad + 18 * S, 8 * S, "rgba(207,232,210,.7)");

  // bottom-center: shortcuts
  hudText(h, "[B] Build   [S] Skills   [E] Equipment", screenW / 2, screenH - pad - 5 * S, 9 * S, "#e3d9b8", "center", true);
  // bottom-right: move hint
  hudText(h, "WASD/click move · click monster, tree or rock", screenW - pad, screenH - pad - 5 * S, 7 * S, "rgba(220,235,225,.5)", "right");

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
