/** Screen-space HUD: HP/EXP bars, cap, gold, minimap, action bar, overlays. */
import { isSafeTile } from "../world/collision.ts";
import { TILE } from "../config.ts";
import { SPR, iconW, iconH } from "../gfx/sprites.ts";
import { clamp } from "../util.ts";
import { ITEMS, walletAcross } from "../items.ts";
import { activeTask, progressOf } from "../systems/tasks.ts";
import { placeHud, hudUserScale } from "../systems/hudLayout.ts";
import { carryCap, carriedWeight } from "../entities/player.ts";
import { stance, stanceAtk, stanceDef, STANCE_LABEL, STANCE_COLOR } from "../systems/stance.ts";
import type { Player } from "../entities/player.ts";
import type { Game } from "../game.ts";
import { ring, raisedBox, sunkenBox, bevelPx } from "./chrome.ts";

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
  /**
   * The fixed chrome — vitals, purse, minimap, location — is being drawn by
   * something else this frame (the phone's top strip). Same suppression the
   * sidebar performs, under a name that does not lie about which one it is.
   */
  fixedChrome?: boolean;
  /**
   * First y (device px) that is world rather than chrome. Zero everywhere but
   * a phone, where the top strip would otherwise swallow the zone banner and
   * the flash line whole — both are drawn a few dozen pixels from the top,
   * which used to be sky and is now an opaque plate.
   */
  contentTop?: number;
  /** Width (device px) of the docked desktop sidebar; 0/undefined = none.
   *  When set, the floating vitals/gold/TP/minimap are skipped (the sidebar
   *  draws its own) and centered overlays center on the visible area. */
  sidebarW?: number;
}

/* The HUD keeps its own teal palette — it is a different layer from the amber
 * windows and reading as one would be worse, not better. What it borrows is
 * the DEPTH: frames raised, bars and the minimap sunk into them. */
function panel(h: HudCtx, x: number, y: number, w: number, ph: number): void {
  const { ctx, scale: S } = h;
  ring(ctx, x, y, w, ph, bevelPx(S), "#050807");
  const b = bevelPx(S);
  raisedBox(ctx, x + b, y + b, w - 2 * b, ph - 2 * b,
    "rgba(12,24,22,.82)", "#4e7268", "#08110f", S);
}

function bar(h: HudCtx, x: number, y: number, w: number, ph: number, frac: number, fg: string, bg: string): void {
  const { ctx, scale: S } = h;
  sunkenBox(ctx, x - S, y - S, w + 2 * S, ph + 2 * S, bg, "#05100e", "#40605a", S);
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, ph);
  ctx.fillStyle = fg;
  ctx.fillRect(x, y, Math.round(w * clamp(frac, 0, 1)), ph);
  ctx.fillStyle = "rgba(255,255,255,.18)";
  ctx.fillRect(x, y, Math.round(w * clamp(frac, 0, 1)), Math.ceil(ph / 3));
}

/**
 * The font `hudText` draws with — exported because MEASURING with a different
 * one is a bug that looks like a layout bug.
 *
 * The Look card sized itself with plain `monospace` and was then painted in
 * `'Courier New'`, which is wider. Every line came out a few pixels longer
 * than the box that had just been built to hold it, so the longest one ran out
 * through the frame. One string, one source, and the two can no longer differ.
 */
export function hudFont(size: number, bold = false): string {
  return `${bold ? "bold " : ""}${Math.round(size)}px 'Courier New',monospace`;
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
  /**
   * Hard width budget in device px. Text longer than this is stepped down a
   * size at a time and then, if it still will not fit, cut with an ellipsis.
   *
   * Without a budget a long line simply runs out of the panel and off the
   * screen: "Upgrade to III: 1000 wood + 1000 stone + ..." was doing exactly
   * that, and so was the backpack's hint. A panel that leaks its own text is
   * worse than one that abbreviates it, because the escaped part is drawn on
   * top of the world and reads as a rendering fault.
   */
  maxW?: number,
): void {
  const { ctx, scale: S } = h;
  const font = (px: number): string => hudFont(px, bold);
  let shown = str;
  let px = size;
  ctx.font = font(px);
  if (maxW !== undefined && maxW > 0) {
    const floor = Math.max(5 * S, size * 0.7);
    while (px > floor && ctx.measureText(shown).width > maxW) {
      px -= Math.max(1, size * 0.06);
      ctx.font = font(px);
    }
    if (ctx.measureText(shown).width > maxW) {
      while (shown.length > 1 && ctx.measureText(shown + "\u2026").width > maxW) {
        shown = shown.slice(0, -1);
      }
      shown += "\u2026";
    }
  }
  ctx.textAlign = align;
  ctx.fillStyle = "rgba(0,0,0,.7)";
  ctx.fillText(shown, x + S, y + S);
  ctx.fillStyle = color;
  ctx.fillText(shown, x, y);
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
/**
 * The minimap, filling the rect it is given.
 *
 * `mh` defaults to `size`, which is how every square caller already used it.
 * The sidebar passes both, because a square map in a 100-unit-tall block left
 * a third of the block empty — and the blit already stretches a non-square
 * world into whatever box it is handed, so honouring two dimensions changes
 * nothing about how faithful it is.
 */
export function drawMinimapAt(
  h: HudCtx, game: Game, p: Player, x: number, y: number, size: number, mh = size,
): void {
  const { ctx, scale: S } = h;
  const w = game.current;
  const sx = size / (w.w * TILE);
  const sy = mh / (w.h * TILE);
  sunkenBox(ctx, x - 2 * S, y - 2 * S, size + 4 * S, mh + 4 * S,
    "rgba(6,14,13,.85)", "#05100e", "#4e7268", S);
  // terrain: one blit of the per-world cache (pixelated, like the game art)
  const wasSmooth = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(minimapTerrain(w), x, y, size, mh);
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
export const VITALS_H = 68;

/** The HP / EXP / Cap / stance panel at an arbitrary top-left and scale. */
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
  // stance: the one combat setting you change mid-fight, so it lives where
  // your eye already is — next to the HP bar, not buried in a panel
  const st = stance();
  const stColor = STANCE_COLOR[st];
  const chipW = 66 * S;
  const chipX = px + 10 * S;
  const chipY = py + 50 * S;
  h.ctx.fillStyle = "rgba(0,0,0,.35)";
  h.ctx.fillRect(chipX, chipY, chipW, 12 * S);
  h.ctx.fillStyle = stColor;
  h.ctx.fillRect(chipX, chipY, 3 * S, 12 * S);
  hudText(h, STANCE_LABEL[st], chipX + 8 * S, chipY + 6 * S, 7 * S, stColor, "left", true);
  hudText(h, `atk ×${stanceAtk().toFixed(2)}  def ×${stanceDef().toFixed(1)}`, px + 145 * S, chipY + 6 * S, 7 * S, "rgba(220,214,190,.65)", "right");
  hudText(h, "[X]", chipX + chipW + 4 * S, chipY + 6 * S, 6 * S, "rgba(220,214,190,.4)");
}

/**
 * Every gold piece the player owns: carried AND banked in their chests.
 *
 * Deliberately WIDER than `p.gold`, which counts only the coins in the worn
 * backpack. The HUD figure is a net-worth readout — the question it answers is
 * "how rich am I", and a number that dropped by three thousand because you
 * tidied your purse into a chest would answer it badly. Spending still comes
 * out of the right purse for each shop; see the shop panel, which labels its
 * own total as carried so the two can never be mistaken for each other.
 */
export function totalGold(game: Game, p: Player): number {
  const chests = game.worlds.home.structures
    .filter((s) => s.key === "chest" && s.inv)
    .map((s) => s.inv!);
  return walletAcross([p.bag, ...chests]);
}

/**
 * Break `str` into lines that each fit `maxW`, at spaces where possible.
 *
 * Truncating with an ellipsis was the first answer and it was the wrong one:
 * "Upgrade to III: 1000 wood + 1000 stone + 500 iron + 100 essentia…" hides
 * the very numbers the line exists to tell you. Wrapping keeps all of it.
 *
 * A word longer than the whole budget is cut mid-word rather than allowed to
 * overhang — otherwise one absurd item name would leak out of the frame again.
 */
export function wrapText(h: HudCtx, str: string, size: number, maxW: number, bold = false): string[] {
  const { ctx } = h;
  ctx.font = hudFont(size, bold);
  if (maxW <= 0 || ctx.measureText(str).width <= maxW) return [str];
  const lines: string[] = [];
  let line = "";
  for (const word of str.split(" ")) {
    const probe = line ? `${line} ${word}` : word;
    if (ctx.measureText(probe).width <= maxW) { line = probe; continue; }
    if (line) { lines.push(line); line = ""; }
    let rest = word;
    while (ctx.measureText(rest).width > maxW && rest.length > 1) {
      let cut = rest.length;
      while (cut > 1 && ctx.measureText(rest.slice(0, cut)).width > maxW) cut--;
      lines.push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
    line = rest;
  }
  if (line) lines.push(line);
  return lines;
}

/** Draw `lines` down the page, returning the y just past the last one. */
export function hudLines(
  h: HudCtx, lines: string[], x: number, y: number, size: number, color: string,
  align: CanvasTextAlign = "left", bold = false,
): number {
  let ly = y;
  for (const ln of lines) {
    hudText(h, ln, x, ly, size, color, align, bold);
    ly += size * 1.25;
  }
  return ly;
}

/** Compact gold + TP row (used by the desktop sidebar). */
export function drawGoldTP(h: HudCtx, p: Player, x: number, y: number, w: number, rowH: number, gold = p.gold): void {
  const { ctx, scale: S } = h;
  panel(h, x, y, w, rowH);
  /* Scale the coin to the ROW, not to a fixed multiple of the HUD unit. In
   * the sidebar the row is set by the column's own ruler, so a 1.5x coin
   * stood taller than the frame around it and clipped top and bottom. */
  const cd = SPR.coin;
  const csc = Math.min(1.5 * S, (rowH - 4 * S) / iconH(cd, 1));
  const cdw = iconW(cd, csc);
  const cdh = iconH(cd, csc);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(cd, x + 5 * S, y + (rowH - cdh) / 2, cdw, cdh);
  hudText(h, `${gold}`, x + 5 * S + cdw + 4 * S, y + rowH / 2, 8 * S, "#f3eedd", "left", true);
  hudText(h, "TP", x + w - 8 * S - 24 * S, y + rowH / 2, 7 * S, "#9ad0ff", "left", true);
  hudText(h, `${p.taskPoints}`, x + w - 6 * S, y + rowH / 2, 8 * S, "#f3eedd", "right", true);
}

export function drawHud(h: HudCtx, game: Game, p: Player): void {
  const { ctx, scale: S, screenW, screenH } = h;
  const pad = 8 * S;
  const sidebar = (h.sidebarW ?? 0) > 0 || !!h.fixedChrome;
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
    const cdw = iconW(cd, 2 * S);
    const cdh = iconH(cd, 2 * S);
    const goldStr = `${totalGold(game, p)}`;
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

  // top-left: title + zone. The phone puts the zone in its own strip and has
  // no room for a wordmark laid over the world, so both are skipped there.
  if (!h.fixedChrome) {
  hudText(h, "BONE ISLE", pad + 2, pad + 7 * S, 11 * S, "#cfe8d2", "left", true);
  hudText(h, game.current.name + (isSafeTile(game.current, game.player.tx, game.player.ty) ? " · safe" : " · danger"), pad + 2, pad + 18 * S, 8 * S, "rgba(207,232,210,.7)");
  }

  // active board-task tracker
  const task = activeTask();
  if (task && !h.fixedChrome) {
    const prog = progressOf(task, p.bag);
    const label = task.goal.kind === "kill"
      ? `${task.goal.monster}`
      : `${ITEMS[task.goal.item].name}`;
    const done = prog >= task.goal.need;
    hudText(h, `Task: ${prog}/${task.goal.need} ${label}`, pad + 2, pad + 29 * S, 8 * S, done ? "#9fe8a8" : "rgba(154,208,255,.85)");
  }

  // Floating minimap top-right — the column hosts its own on desktop, as the
  // first of Tibia's fixed blocks.
  if (!sidebar) {
    const size = 70 * S;
    drawMinimapAt(h, game, p, screenW - size - 8 * S, 40 * S, size);
  }

  // zone flash (centered on the visible, non-sidebar area)
  if (game.zoneFlash.t > 0) {
    ctx.globalAlpha = clamp(game.zoneFlash.t, 0, 1);
    hudText(h, game.zoneFlash.text, cx, (h.contentTop ?? 0) + 40 * S, 16 * S, "#ffe9a8", "center", true);
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
