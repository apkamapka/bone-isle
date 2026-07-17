/** Screen-space HUD: HP/EXP bars, cap, gold, minimap, action bar, overlays. */
import { TILE } from "../config.ts";
import { SPR } from "../gfx/sprites.ts";
import { clamp } from "../util.ts";
import { ITEMS } from "../items.ts";
import { activeTask, progressOf } from "../systems/tasks.ts";
import { placeHud, hudUserScale } from "../systems/hudLayout.ts";
import { carryCap, carriedWeight } from "../entities/player.ts";
import type { Player } from "../entities/player.ts";
import type { Game } from "../game.ts";

export interface HudCtx {
  ctx: CanvasRenderingContext2D;
  scale: number;
  /** Base scale for panel windows; smaller than `scale` on desktop so big
   *  panels (Forge, task board) don't swallow the screen. Panels additionally
   *  auto-shrink per window if they'd still spill off-screen. */
  panelScale?: number;
  screenW: number;
  screenH: number;
  touch?: boolean;
  /** True only on a REAL touch device (touchUI above is on everywhere). */
  touchInput?: boolean;
  /** Width (device px) of the docked desktop sidebar; 0/undefined = none.
   *  When set, the floating vitals/gold/TP/minimap are skipped (the sidebar
   *  draws its own) and centered overlays center on the visible area. */
  sidebarW?: number;
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

/**
 * Cached minimap terrain, one tiny canvas per world. The old code re-sampled
 * the whole tile grid with fillRect EVERY frame — on the 368x272 continent
 * that was ~25,000 fillRect calls per frame and the main cause of big-map lag.
 * Terrain is static per world, so it's now baked ONCE (via ImageData, so the
 * bake itself is instant) at one pixel per tile and each frame just blits it
 * scaled; only the dynamic dots (portals, monsters, player) draw on top.
 */
const miniCache = new Map<string, HTMLCanvasElement>();
function minimapTerrain(w: Game["current"]): HTMLCanvasElement {
  const hit = miniCache.get(w.key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = w.w;
  c.height = w.h;
  const cx = c.getContext("2d")!;
  const img = cx.createImageData(w.w, w.h);
  const d = img.data;
  // identical palette to the old per-frame sampler:
  // water #1c6060, sand #c8b47a, wall #6b7275, everything else grass #557a34
  for (let ty = 0; ty < w.h; ty++) {
    for (let tx = 0; tx < w.w; tx++) {
      const t = w.tile[ty][tx];
      const i = (ty * w.w + tx) * 4;
      if (t === 0) { d[i] = 0x1c; d[i + 1] = 0x60; d[i + 2] = 0x60; }
      else if (t === 2) { d[i] = 0xc8; d[i + 1] = 0xb4; d[i + 2] = 0x7a; }
      else if (t === 3) { d[i] = 0x6b; d[i + 1] = 0x72; d[i + 2] = 0x75; }
      else { d[i] = 0x55; d[i + 1] = 0x7a; d[i + 2] = 0x34; }
      d[i + 3] = 255;
    }
  }
  cx.putImageData(img, 0, 0);
  miniCache.set(w.key, c);
  return c;
}

/** Minimap blitted at an arbitrary (x,y) with a given pixel size. */
export function drawMinimapAt(h: HudCtx, game: Game, p: Player, x: number, y: number, size: number): void {
  const { ctx, scale: S } = h;
  const w = game.current;
  const sx = size / (w.w * TILE);
  const sy = size / (w.h * TILE);
  ctx.fillStyle = "rgba(6,14,13,.85)";
  ctx.fillRect(x - 2 * S, y - 2 * S, size + 4 * S, size + 4 * S);
  ctx.strokeStyle = "#3d5a50";
  ctx.lineWidth = S;
  ctx.strokeRect(x - 2 * S + S / 2, y - 2 * S + S / 2, size + 4 * S - S, size + 4 * S - S);
  // terrain: one blit of the per-world cache (pixelated, like the game art)
  const wasSmooth = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(minimapTerrain(w), x, y, size, size);
  ctx.imageSmoothingEnabled = wasSmooth;
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

/** Reference vitals-panel size (design px) — multiply by a scale to place it. */
export const VITALS_W = 190;
export const VITALS_H = 54;

/** The HP / EXP / Cap panel at an arbitrary top-left with its own scale. */
export function drawVitals(h: HudCtx, p: Player, px: number, py: number, S: number): void {
  panel({ ...h, scale: S }, px, py, VITALS_W * S, VITALS_H * S);
  bar({ ...h, scale: S }, px + 10 * S, py + 8 * S, 130 * S, 8 * S, p.hp / p.maxhp, "#e1483b", "#5d1a14");
  hudText(h, `HP ${Math.ceil(p.hp)}/${p.maxhp}`, px + 145 * S, py + 11 * S + 1, 8 * S, "#ffd9d4");
  bar({ ...h, scale: S }, px + 10 * S, py + 22 * S, 130 * S, 8 * S, p.exp / p.expNext, "#b07fe8", "#3c2752");
  hudText(h, `Lv ${p.level}`, px + 145 * S, py + 25 * S + 1, 8 * S, "#e6d4ff");
  const cap = carryCap(p);
  const used = Math.round(carriedWeight(p));
  const capFull = used >= cap;
  hudText(h, "Cap", px + 10 * S, py + 40 * S, 8 * S, "rgba(220,214,190,.7)");
  bar({ ...h, scale: S }, px + 34 * S, py + 37 * S, 106 * S, 6 * S, used / cap, capFull ? "#e06a4a" : "#caa15a", "#3a3222");
  hudText(h, `${used}/${cap}`, px + 145 * S, py + 40 * S, 8 * S, capFull ? "#ffb59a" : "#e8dcc0");
}

/** Compact gold + TP row (used by the desktop sidebar). */
export function drawGoldTP(h: HudCtx, p: Player, x: number, y: number, w: number, rowH: number): void {
  const { ctx, scale: S } = h;
  panel(h, x, y, w, rowH);
  const cd = SPR.coin;
  const cdw = cd.width * 1.5 * S;
  const cdh = cd.height * 1.5 * S;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(cd, x + 5 * S, y + (rowH - cdh) / 2, cdw, cdh);
  hudText(h, `${p.gold}`, x + 5 * S + cdw + 4 * S, y + rowH / 2, 8 * S, "#f3eedd", "left", true);
  hudText(h, "TP", x + w - 8 * S - 24 * S, y + rowH / 2, 7 * S, "#9ad0ff", "left", true);
  hudText(h, `${p.taskPoints}`, x + w - 6 * S, y + rowH / 2, 8 * S, "#f3eedd", "right", true);
}

export function drawHud(h: HudCtx, game: Game, p: Player): void {
  const { ctx, scale: S, screenW, screenH } = h;
  const pad = 8 * S;
  const sidebar = (h.sidebarW ?? 0) > 0;
  /** Horizontal center of the VISIBLE (non-sidebar) area for overlays. */
  const cx = (screenW - (h.sidebarW ?? 0)) / 2;
  ctx.textBaseline = "middle";

  // bottom-left: HP + EXP + Cap  (draggable on touch via the customizable HUD;
  // scaled by the user's HUD-scale preference; drawn by the sidebar on desktop)
  if (!sidebar) {
    const u = h.touch ? hudUserScale() : 1;
    const Sv = S * u;
    const pw = VITALS_W * Sv;
    const ph = VITALS_H * Sv;
    let px = pad;
    let py = screenH - ph - pad;
    if (h.touch) { const pos = placeHud("vitals", pw, ph, screenW, screenH); px = pos.x; py = pos.y; }
    drawVitals(h, p, px, py, Sv);
  }

  // top-right: gold (box auto-sizes so big amounts always fit the frame);
  // in sidebar mode the sidebar draws its own compact gold + TP row
  if (!sidebar) {
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

    // task points box, sitting just left of the gold box on the same row
    const tpStr = `${p.taskPoints}`;
    ctx.font = `bold ${9 * S}px monospace`;
    const tpNumW = ctx.measureText(tpStr).width;
    ctx.font = `${8 * S}px monospace`;
    const tpLabW = ctx.measureText("TP").width;
    const tpw = 12 * S + tpLabW + 6 * S + tpNumW + 10 * S;
    const tpx = ix - tpw - 6 * S;
    panel(h, tpx, iy, tpw, ih);
    hudText(h, "TP", tpx + 10 * S, iy + ih / 2, 8 * S, "#9ad0ff", "left", true);
    hudText(h, tpStr, tpx + tpw - 8 * S, iy + ih / 2, 9 * S, "#f3eedd", "right", true);
  }

  // top-left: title + zone
  hudText(h, "BONE ISLE", pad + 2, pad + 7 * S, 11 * S, "#cfe8d2", "left", true);
  hudText(h, game.current.name + (game.current.safe ? " · safe" : " · danger"), pad + 2, pad + 18 * S, 8 * S, "rgba(207,232,210,.7)");

  // active board-task tracker
  const task = activeTask();
  if (task) {
    const prog = progressOf(task, p.bag);
    const label = task.goal.kind === "kill"
      ? `${task.goal.monster}`
      : `${ITEMS[task.goal.item].name}`;
    const done = prog >= task.goal.need;
    hudText(h, `Task: ${prog}/${task.goal.need} ${label}`, pad + 2, pad + 29 * S, 8 * S, done ? "#9fe8a8" : "rgba(154,208,255,.85)");
  }

  // floating minimap top-right — the sidebar hosts its own copy on desktop
  if (!sidebar) {
    const size = 70 * S;
    drawMinimapAt(h, game, p, screenW - size - 8 * S, 40 * S, size);
  }

  // zone flash (centered on the visible, non-sidebar area)
  if (game.zoneFlash.t > 0) {
    ctx.globalAlpha = clamp(game.zoneFlash.t, 0, 1);
    hudText(h, game.zoneFlash.text, cx, 40 * S, 16 * S, "#ffe9a8", "center", true);
    ctx.globalAlpha = 1;
  }

  // death overlay
  if (p.dead) {
    ctx.fillStyle = "rgba(20,10,10,.45)";
    ctx.fillRect(0, 0, screenW, screenH);
    hudText(h, "You died", cx, screenH / 2 - 8 * S, 22 * S, "#ff6a5e", "center", true);
    hudText(h, `respawning at Home Isle in ${Math.ceil(p.deadT)}...`, cx, screenH / 2 + 12 * S, 10 * S, "#f3eedd", "center");
  }
}
